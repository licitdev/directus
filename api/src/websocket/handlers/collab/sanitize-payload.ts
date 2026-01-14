import type { Accountability, Permission, SchemaOverview } from '@directus/types';
import type { Knex } from 'knex';
import { isEmpty } from 'lodash-es';
import { fetchPermissions } from '../../../permissions/lib/fetch-permissions.js';
import { fetchPolicies } from '../../../permissions/lib/fetch-policies.js';
import { extractRequiredDynamicVariableContextForPermissions } from '../../../permissions/utils/extract-required-dynamic-variable-context.js';
import { fetchDynamicVariableData } from '../../../permissions/utils/fetch-dynamic-variable-data.js';
import { processPermissions } from '../../../permissions/utils/process-permissions.js';
import { ItemsService } from '../../../services/index.js';
import { filterItems } from '../../../utils/filter-items.js';
import { isFieldAllowed } from '../../../utils/is-field-allowed.js';
import { asyncDeepMapWithSchema } from '../../../utils/versioning/deep-map-with-schema.js';

/**
 * Sanitizes a payload based on the user's permissions.
 * Optionally accepts a list of pre-verified allowed fields for the root collection.
 * For nested relational collections, permissions are always fetched and checked per-collection.
 */
export async function sanitizePayload(
	collection: string,
	payload: Record<string, unknown>,
	ctx: { knex: Knex; schema: SchemaOverview; accountability: Accountability },
	allowedFields?: string[],
) {
	const { accountability, schema } = ctx;

	// Always fetch permissions to handle nested relational collections
	const policies = await fetchPolicies(accountability, { knex: ctx.knex, schema: ctx.schema });

	const rawPermissions = await fetchPermissions(
		{ policies, accountability, action: 'read', bypassDynamicVariableProcessing: true },
		{ knex: ctx.knex, schema: ctx.schema },
	);

	const dynamicVariableContext = extractRequiredDynamicVariableContextForPermissions(rawPermissions);

	const permissionsContext = await fetchDynamicVariableData(
		{ accountability, policies, dynamicVariableContext },
		{ knex: ctx.knex, schema: ctx.schema },
	);

	const permissions = processPermissions({
		permissions: rawPermissions,
		accountability,
		permissionsContext,
	});

	const permissionsByCollection = permissions.reduce<Record<string, Permission[]>>((acc, perm) => {
		if (!(perm.collection in acc)) acc[perm.collection] = [];
		acc[perm.collection]!.push(perm);
		return acc;
	}, {});

	// Track the root collection to know when to use allowedFields vs permissionsByCollection
	const rootCollection = collection;

	// Cache Services to avoid re-instantiating for every field
	const serviceCache = new Map<string, ItemsService<any>>();

	const getService = (collection: string) => {
		if (!serviceCache.has(collection)) {
			serviceCache.set(collection, new ItemsService(collection, ctx));
		}

		return serviceCache.get(collection)!;
	};

	// Cache Item Read results (scoped to this request) to prevent N+1 queries
	// Key: "${collection}:${pk}"
	const itemReadCache = new Map<string, Record<string, any> | null>();

	return await asyncDeepMapWithSchema(
		payload,
		async ([key, value], context) => {
			if (context.field.special.some((v) => v === 'conceal' || v === 'hash')) return;

			// Filter out {} or [] values for relations
			if ((context.relationType === 'm2o' || context.relationType === 'a2o') && isEmpty(value)) return;

			// For o2m and o2a relations, filter empty objects from arrays (including detailed update syntax)
			if ((context.relationType === 'o2m' || context.relationType === 'o2a') && typeof value === 'object') {
				if (Array.isArray(value)) {
					value = (value as Array<unknown>).filter((v) => !isEmpty(v));
					if ((value as Array<unknown>).length === 0) return;
				} else if (isDetailedUpdateSyntax(value)) {
					// Filter empty objects from create/update/delete arrays
					const filtered = {
						create: value.create.filter((v) => !isEmpty(v)),
						update: value.update.filter((v) => !isEmpty(v)),
						delete: value.delete.filter((v) => !isEmpty(v)),
					};

					// If all arrays are empty, omit the field entirely
					if (filtered.create.length === 0 && filtered.update.length === 0 && filtered.delete.length === 0) {
						return;
					}

					value = filtered;
				}
			}

			const currentCollection = context.collection.collection;
			const isRootCollection = currentCollection === rootCollection;

			// checkMemoryPermissions Helper
			const checkMemoryPermissions = () => {
				const collectionPerms = permissionsByCollection[currentCollection] || [];
				return collectionPerms.some((perm) => {
					if (!isFieldAllowed(perm.fields ?? [], String(key))) return false;
					if (!perm.permissions || Object.keys(perm.permissions).length === 0) return true;
					return filterItems([context.object as any], perm.permissions).length > 0;
				});
			};

			// Use allowedFields only for root collection, permissionsByCollection for nested collections
			let readAllowed = false;

			const isUpdate = !isRootCollection && context.collection.primary in context.object;

			if (accountability.admin === true) {
				readAllowed = true;
			} else if (isRootCollection && allowedFields) {
				readAllowed = isFieldAllowed(allowedFields, String(key));
			} else {
				if (isUpdate) {
					// Basic field check first
					readAllowed =
						permissionsByCollection[currentCollection]?.some((perm) =>
							isFieldAllowed(perm.fields ?? [], String(key)),
						) ?? false;
				} else {
					// For nested "creates" (no primary key), valid permissions must be evaluated against the object itself (Memory Check)
					readAllowed = checkMemoryPermissions();
				}
			}

			if (!readAllowed) return;

			// Check item-level permissions for nested updates via DB
			if (isUpdate) {
				const pk = context.object[context.collection.primary] as string | number;
				const cacheKey = `${currentCollection}:${pk}`;

				// Check cache first
				if (itemReadCache.has(cacheKey)) {
					const cachedItem = itemReadCache.get(cacheKey);

					// If cache has item, check if key is present (meaning it was allowed/read)
					// If cache is null (previous read failed), fallback to memory check
					if (cachedItem) {
						if (!(key in cachedItem)) return; // Field was filtered out in read
					} else {
						// Previous read failed, use memory check
						if (!checkMemoryPermissions()) return;
					}
				} else {
					const service = getService(currentCollection);

					try {
						// Optimisation: Fetch ALL allowed fields for this item at once
						// This populates the cache for subsequent field checks
						// We use '*' which will return all fields identifiable as readable by the service
						const item = await service.readOne(pk, { fields: ['*'] });
						itemReadCache.set(cacheKey, item);

						if (!(key in item)) return; // Field filtered out
					} catch (err: any) {
						// DEBUG LOG
						console.log(`[sanitizePayload] readOne Error for ${cacheKey} (key=${key}):`, err.code || err.message);

						// Read failed (Not Found / Forbidden) -> Fallback to memory check
						itemReadCache.set(cacheKey, null); // Mark as failed in cache

						if (!checkMemoryPermissions()) {
							console.log(`[sanitizePayload] Memory Check FAILED for ${key}`);
							return;
						} else {
							console.log(`[sanitizePayload] Memory Check PASSED for ${key}`);
						}
					}
				}
			}

			return [key, value];
		},
		{
			schema,
			collection,
		},
		{
			detailedUpdateSyntax: true,
			omitUnknownFields: true,
			mapPrimaryKeys: true,
		},
	);
}

function isDetailedUpdateSyntax(value: unknown): value is { create: unknown[]; update: unknown[]; delete: unknown[] } {
	return (
		typeof value === 'object' &&
		value !== null &&
		Array.isArray((value as any)['create']) &&
		Array.isArray((value as any)['update']) &&
		Array.isArray((value as any)['delete'])
	);
}

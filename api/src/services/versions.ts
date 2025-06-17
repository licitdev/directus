import { Action } from '@directus/constants';
import { ForbiddenError, InvalidPayloadError, UnprocessableContentError } from '@directus/errors';
import type { ContentVersion, Field, Filter, Item, PrimaryKey, Query } from '@directus/types';
import { getRelationType } from '@directus/utils';
import Joi from 'joi';
import { assign, pick } from 'lodash-es';
import objectHash from 'object-hash';
import { getCache } from '../cache.js';
import { getRelatedCollection } from '../database/get-ast-from-query/utils/get-related-collection.js';
import emitter from '../emitter.js';
import { validateAccess } from '../permissions/modules/validate-access/validate-access.js';
import type { AbstractServiceOptions, MutationOptions } from '../types/index.js';
import { shouldClearCache } from '../utils/should-clear-cache.js';
import { ActivityService } from './activity.js';
import { ItemsService } from './items.js';
import { PayloadService } from './payload.js';
import { RevisionsService } from './revisions.js';

// TODO: Add support for complex deep queries, filters, limit, etc and move to utils.
function extractNestedQuery(
	parentQuery: Query,
	relationKey: string /*, schema?: SchemaOverview, collectionName?: string */,
): Query {
	const nestedQuery: Query = {};

	if (parentQuery.fields) {
		for (const field of parentQuery.fields) {
			if (field.includes('.') && (field.startsWith(`${relationKey}.`) || field.startsWith(`*`))) {
				(nestedQuery.fields || (nestedQuery.fields = [])).push(field.split('.').slice(1).join('.'));
			}
		}
	}

	return nestedQuery;
}

export class VersionsService extends ItemsService {
	constructor(options: AbstractServiceOptions) {
		super('directus_versions', options);
	}

	private async validateCreateData(data: Partial<Item>): Promise<void> {
		const versionCreateSchema = Joi.object({
			key: Joi.string().required(),
			name: Joi.string().allow(null),
			collection: Joi.string().required(),
			item: Joi.string().required(),
		});

		const { error } = versionCreateSchema.validate(data);
		if (error) throw new InvalidPayloadError({ reason: error.message });

		// Reserves the "main" version key for the version query parameter
		if (data['key'] === 'main') throw new InvalidPayloadError({ reason: `"main" is a reserved version key` });

		if (this.accountability) {
			try {
				await validateAccess(
					{
						accountability: this.accountability,
						action: 'read',
						collection: data['collection'],
						primaryKeys: [data['item']],
					},
					{
						schema: this.schema,
						knex: this.knex,
					},
				);
			} catch {
				throw new ForbiddenError();
			}
		}

		const { CollectionsService } = await import('./collections.js');

		const collectionsService = new CollectionsService({
			knex: this.knex,
			schema: this.schema,
		});

		const existingCollection = await collectionsService.readOne(data['collection']);

		if (!existingCollection.meta?.versioning) {
			throw new UnprocessableContentError({
				reason: `Content Versioning is not enabled for collection "${data['collection']}"`,
			});
		}

		const sudoService = new VersionsService({
			knex: this.knex,
			schema: this.schema,
		});

		const existingVersions = await sudoService.readByQuery({
			aggregate: { count: ['*'] },
			filter: { key: { _eq: data['key'] }, collection: { _eq: data['collection'] }, item: { _eq: data['item'] } },
		});

		if (existingVersions[0]!['count'] > 0) {
			throw new UnprocessableContentError({
				reason: `Version "${data['key']}" already exists for item "${data['item']}" in collection "${data['collection']}"`,
			});
		}
	}

	async getMainItem(collection: string, item: PrimaryKey, query?: Query): Promise<Item> {
		const itemsService = new ItemsService(collection, {
			knex: this.knex,
			accountability: this.accountability,
			schema: this.schema,
		});

		return await itemsService.readOne(item, query);
	}

	async verifyHash(
		collection: string,
		item: PrimaryKey,
		hash: string,
	): Promise<{ outdated: boolean; mainHash: string }> {
		const mainItem = await this.getMainItem(collection, item);

		const mainHash = objectHash(mainItem);

		return { outdated: hash !== mainHash, mainHash };
	}

	async getVersionSaves(key: string, collection: string, item: string | undefined): Promise<Partial<Item>[] | null> {
		const filter: Filter = {
			key: { _eq: key },
			collection: { _eq: collection },
		};

		if (item) {
			filter['item'] = { _eq: item };
		}

		const versions = await this.readByQuery({ filter });

		if (!versions?.[0]) return null;

		if (versions[0]['delta']) {
			return [versions[0]['delta']];
		}

		return null;
	}

	override async createOne(data: Partial<Item>, opts?: MutationOptions): Promise<PrimaryKey> {
		await this.validateCreateData(data);

		const mainItem = await this.getMainItem(data['collection'], data['item']);

		data['hash'] = objectHash(mainItem);

		return super.createOne(data, opts);
	}

	override async createMany(data: Partial<Item>[], opts?: MutationOptions): Promise<PrimaryKey[]> {
		if (!Array.isArray(data)) {
			throw new InvalidPayloadError({ reason: 'Input should be an array of items' });
		}

		const keyCombos = new Set();

		for (const item of data) {
			const keyCombo = `${item['key']}-${item['collection']}-${item['item']}`;

			if (keyCombos.has(keyCombo)) {
				throw new UnprocessableContentError({
					reason: `Cannot create multiple versions on "${item['item']}" in collection "${item['collection']}" with the same key "${item['key']}"`,
				});
			}

			keyCombos.add(keyCombo);
		}

		return super.createMany(data, opts);
	}

	override async updateMany(keys: PrimaryKey[], data: Partial<Item>, opts?: MutationOptions): Promise<PrimaryKey[]> {
		// Only allow updates on "key" and "name" fields
		const versionUpdateSchema = Joi.object({
			key: Joi.string(),
			name: Joi.string().allow(null),
		});

		const { error } = versionUpdateSchema.validate(data);
		if (error) throw new InvalidPayloadError({ reason: error.message });

		if ('key' in data) {
			// Reserves the "main" version key for the version query parameter
			if (data['key'] === 'main') throw new InvalidPayloadError({ reason: `"main" is a reserved version key` });

			const keyCombos = new Set();

			for (const pk of keys) {
				const { collection, item } = await this.readOne(pk, { fields: ['collection', 'item'] });

				const keyCombo = `${data['key']}-${collection}-${item}`;

				if (keyCombos.has(keyCombo)) {
					throw new UnprocessableContentError({
						reason: `Cannot update multiple versions on "${item}" in collection "${collection}" to the same key "${data['key']}"`,
					});
				}

				keyCombos.add(keyCombo);

				const existingVersions = await super.readByQuery({
					aggregate: { count: ['*'] },
					filter: { id: { _neq: pk }, key: { _eq: data['key'] }, collection: { _eq: collection }, item: { _eq: item } },
				});

				if (existingVersions[0]!['count'] > 0) {
					throw new UnprocessableContentError({
						reason: `Version "${data['key']}" already exists for item "${item}" in collection "${collection}"`,
					});
				}
			}
		}

		return super.updateMany(keys, data, opts);
	}

	async save(key: PrimaryKey, data: Partial<Item>): Promise<Partial<Item>> {
		const version = await super.readOne(key);

		const payloadService = new PayloadService(this.collection, {
			accountability: this.accountability,
			knex: this.knex,
			schema: this.schema,
		});

		const activityService = new ActivityService({
			knex: this.knex,
			schema: this.schema,
		});

		const revisionsService = new RevisionsService({
			knex: this.knex,
			schema: this.schema,
		});

		const { item, collection } = version;

		const activity = await activityService.createOne({
			action: Action.VERSION_SAVE,
			user: this.accountability?.user ?? null,
			collection,
			ip: this.accountability?.ip ?? null,
			user_agent: this.accountability?.userAgent ?? null,
			origin: this.accountability?.origin ?? null,
			item,
		});

		const revisionDelta = await payloadService.prepareDelta(data);

		await revisionsService.createOne({
			activity,
			version: key,
			collection,
			item,
			data: revisionDelta,
			delta: revisionDelta,
		});

		const finalVersionDelta = assign({}, version['delta'], revisionDelta ? JSON.parse(revisionDelta) : null);

		const sudoService = new ItemsService(this.collection, {
			knex: this.knex,
			schema: this.schema,
		});

		await sudoService.updateOne(key, { delta: finalVersionDelta });

		const { cache } = getCache();

		if (shouldClearCache(cache, undefined, collection)) {
			cache.clear();
		}

		return finalVersionDelta;
	}

	async promote(version: PrimaryKey, mainHash: string, fields?: string[]) {
		const { collection, item, delta } = (await this.readOne(version)) as ContentVersion;

		// will throw an error if the accountability does not have permission to update the item
		if (this.accountability) {
			await validateAccess(
				{
					accountability: this.accountability,
					action: 'update',
					collection,
					primaryKeys: [item],
				},
				{
					schema: this.schema,
					knex: this.knex,
				},
			);
		}

		if (!delta) {
			throw new UnprocessableContentError({
				reason: `No changes to promote`,
			});
		}

		const { outdated } = await this.verifyHash(collection, item, mainHash);

		if (outdated) {
			throw new UnprocessableContentError({
				reason: `Main item has changed since this version was last updated`,
			});
		}

		const payloadToUpdate = fields ? pick(delta, fields) : delta;

		const itemsService = new ItemsService(collection, {
			accountability: this.accountability,
			knex: this.knex,
			schema: this.schema,
		});

		const payloadAfterHooks = await emitter.emitFilter(
			['items.promote', `${collection}.items.promote`],
			payloadToUpdate,
			{
				collection,
				item,
				version,
			},
			{
				database: this.knex,
				schema: this.schema,
				accountability: this.accountability,
			},
		);

		const updatedItemKey = await itemsService.updateOne(item, payloadAfterHooks);

		emitter.emitAction(
			['items.promote', `${collection}.items.promote`],
			{
				payload: payloadAfterHooks,
				collection,
				item: updatedItemKey,
				version,
			},
			{
				database: this.knex,
				schema: this.schema,
				accountability: this.accountability,
			},
		);

		return updatedItemKey;
	}

	async resolveVersionedItem(
		mainItemData: Item,
		versionDelta: Partial<Item>,
		collectionName: string,
		query: Query,
	): Promise<Item> {
		const workingItem = { ...mainItemData };

		const currentCollection = this.schema.collections[collectionName];

		if (!currentCollection) {
			throw new Error(`Missing collection ${collectionName}`);
		}

		for (const fieldKey of Object.keys(versionDelta)) {
			const deltaValue = versionDelta[fieldKey];
			const currentField = currentCollection.fields[fieldKey] as Field | undefined;

			if (!currentField) {
				// TODO: Decide how to handle missing fields
				continue;
			}

			const currentRelation = this.schema.relations.find(
				(r) =>
					(r.collection === collectionName && r.field === fieldKey) ||
					(r.related_collection === collectionName && r.meta?.one_field === fieldKey),
			);

			if (!currentRelation) {
				workingItem[fieldKey] = deltaValue;
			} else {
				const subQuery = extractNestedQuery.call(this, query, fieldKey);

				const currentRelationType = getRelationType({
					relation: currentRelation,
					collection: collectionName,
					field: fieldKey,
				});

				const relatedCollectionName = getRelatedCollection(this.schema, collectionName, fieldKey)!;

				const relatedItemsService = new ItemsService(relatedCollectionName, {
					knex: this.knex,
					schema: this.schema,
					accountability: this.accountability,
				});

				const relatedCollectionPkField = this.schema.collections[relatedCollectionName]?.primary;

				if (currentRelationType === 'm2o') {
					if (deltaValue === null) {
						workingItem[fieldKey] = null;
					} else if (relatedCollectionPkField && !(relatedCollectionPkField in deltaValue)) {
						workingItem[fieldKey] = await this.resolveVersionedRelations(deltaValue, relatedCollectionName, subQuery);
					} else if (relatedCollectionPkField && relatedCollectionPkField in deltaValue) {
						let currentRelatedItem = workingItem[fieldKey] as Item | PrimaryKey | undefined;

						if (currentRelatedItem && typeof currentRelatedItem !== 'object' && relatedCollectionPkField) {
							currentRelatedItem = await relatedItemsService.readOne(currentRelatedItem as PrimaryKey, subQuery);
						}

						if (currentRelatedItem && typeof currentRelatedItem === 'object') {
							workingItem[fieldKey] = await this.resolveVersionedItem(
								currentRelatedItem,
								deltaValue,
								relatedCollectionName,
								subQuery,
							);
						} else {
							// No current item to update, or couldn't fetch it.
						}
					} else {
						// Assumed to be a PrimaryKey for linking
						const pkToLink = deltaValue as PrimaryKey;
						const fetchedItem = await relatedItemsService.readOne(pkToLink, subQuery);
						workingItem[fieldKey] = fetchedItem;
					}
				}
				// O2M
				else if (currentRelationType === 'o2m') {
					const currentRelatedArray: Item[] = (workingItem[fieldKey] as Item[]) || [];
					const newRelatedArray: Item[] = [];
					const updatesMap = new Map<PrimaryKey, Partial<Item>>();
					const createsArray: Partial<Item>[] = [];
					const deletesSet = new Set<PrimaryKey>();

					if (Array.isArray(deltaValue)) {
						for (const item of deltaValue) {
							if (relatedCollectionPkField && item[relatedCollectionPkField!]) {
								const pk = item[relatedCollectionPkField] as PrimaryKey;
								const itemToAdd = await relatedItemsService.readOne(pk, subQuery);

								if (itemToAdd) newRelatedArray.push(itemToAdd);
							}
						}
					} else {
						createsArray.push(...deltaValue.create);

						if (deltaValue.update && relatedCollectionPkField) {
							for (const item of deltaValue.update) {
								if (item[relatedCollectionPkField]) {
									updatesMap.set(item[relatedCollectionPkField] as PrimaryKey, item);
								}
							}
						}

						for (const item of deltaValue.delete) {
							deletesSet.add(item);
						}
					}

					for (const existingItem of currentRelatedArray) {
						const pk = existingItem[relatedCollectionPkField!] as PrimaryKey;
						if (deletesSet.has(pk)) continue;

						if (updatesMap.has(pk)) {
							const updatedItem = await this.resolveVersionedItem(
								existingItem,
								updatesMap.get(pk)!,
								relatedCollectionName,
								subQuery,
							);

							newRelatedArray.push(updatedItem);
						} else {
							newRelatedArray.push(existingItem);
						}
					}

					for (const createPayload of createsArray) {
						const createdItem = await this.resolveVersionedRelations(createPayload, relatedCollectionName, subQuery);

						console.dir({ createPayload, relatedCollectionName, subQuery, createdItem }, { depth: null });

						newRelatedArray.push(createdItem);
					}

					workingItem[fieldKey] = newRelatedArray;
				}
			}
		}

		return workingItem;
	}

	private async resolveVersionedRelations(payload: Partial<Item>, collectionName: string, query: Query): Promise<Item> {
		const resolvedItem: Item = {};
		const collectionDef = this.schema.collections[collectionName];
		if (!collectionDef) throw new Error(`Collection ${collectionName} not found.`);

		let fieldsToProcess =
			query.fields && query.fields.length > 0 && !query.fields.includes('*')
				? [...query.fields]
				: Object.keys(collectionDef.fields);

		for (const key in payload) {
			if (!fieldsToProcess.includes(key)) fieldsToProcess.push(key);
		}

		fieldsToProcess = [...new Set(fieldsToProcess)];

		for (const fieldKey of fieldsToProcess) {
			const fieldSchema = collectionDef.fields[fieldKey] as Field | undefined;
			const payloadValue = payload[fieldKey];

			if (payloadValue === undefined && fieldSchema?.schema?.default_value !== undefined) {
				resolvedItem[fieldKey] = fieldSchema.schema.default_value;
			} else if (payloadValue !== undefined) {
				const currentRelation = this.schema.relations.find(
					(r) =>
						(r.collection === collectionName && r.field === fieldKey) ||
						(r.related_collection === collectionName && r.meta?.one_field === fieldKey),
				);

				console.log({ collectionName, fieldKey, payloadValue, currentRelation, query });

				if (!currentRelation) {
					resolvedItem[fieldKey] = payloadValue;
				} else {
					const currentRelationType = getRelationType({
						relation: currentRelation,
						collection: collectionName,
						field: fieldKey,
					});

					console.log({ currentRelationType });

					const relatedCollectionName = getRelatedCollection(this.schema, collectionName, fieldKey)!;

					const relatedCollectionPkField = this.schema.collections[relatedCollectionName]?.primary;

					const subQuery = extractNestedQuery.call(this, query, fieldKey);

					const relatedItemsService = new ItemsService(relatedCollectionName, {
						knex: this.knex,
						schema: this.schema,
						accountability: this.accountability,
					});

					if (currentRelationType === 'm2o') {
						if (payloadValue === null) resolvedItem[fieldKey] = null;
						else if (typeof payloadValue === 'object') {
							resolvedItem[fieldKey] = await this.resolveVersionedRelations(
								payloadValue,
								relatedCollectionName,
								subQuery,
							);
						} else {
							const pk = payloadValue as PrimaryKey;

							const fetched = await relatedItemsService.readOne(pk, subQuery);
							resolvedItem[fieldKey] = fetched;
						}
					} else if (currentRelationType === 'o2m') {
						const processedRelated: Item[] = [];
						const newRelatedArray: Item[] = [];
						const updatesMap = new Map<PrimaryKey, Partial<Item>>();
						const createsArray: Partial<Item>[] = [];
						const deletesSet = new Set<PrimaryKey>();

						if (Array.isArray(payloadValue)) {
							for (const item of payloadValue) {
								if (relatedCollectionPkField && item[relatedCollectionPkField!]) {
									const pk = item[relatedCollectionPkField] as PrimaryKey;
									const itemToAdd = await relatedItemsService.readOne(pk, subQuery);

									if (itemToAdd) newRelatedArray.push(itemToAdd);
								}
							}
						} else {
							createsArray.push(...payloadValue.create);

							if (payloadValue.update && relatedCollectionPkField) {
								for (const item of payloadValue.update) {
									if (item[relatedCollectionPkField]) {
										updatesMap.set(item[relatedCollectionPkField] as PrimaryKey, item);
									}
								}
							}

							for (const item of payloadValue.delete) {
								deletesSet.add(item);
							}
						}

						resolvedItem[fieldKey] = processedRelated;
					}
				}
			}
		}

		if (payload[collectionDef.primary] !== undefined && resolvedItem[collectionDef.primary] === undefined) {
			resolvedItem[collectionDef.primary] = payload[collectionDef.primary];
		}

		return resolvedItem;
	}
}

import type { Relation, SchemaOverview } from '@directus/types';
import { getRelations } from '@directus/utils';
import type { Knex } from 'knex';
import type { FieldMap } from '../../types.js';
import { createFieldsForbiddenError } from './create-error.js';

const RELATIONAL_SPECIALS = new Set(['m2o', 'o2m', 'm2m', 'm2a']);

type RelationMetaRow = {
	many_collection: string;
	many_field: string;
	one_collection: string | null;
	one_field: string | null;
	one_allowed_collections: unknown;
};

function isRelationalField(schema: SchemaOverview, collection: string, field: string): boolean {
	const special = schema.collections[collection]?.fields[field]?.special;
	return special?.some((s) => RELATIONAL_SPECIALS.has(s)) ?? false;
}

function addCollectionsFromSchemaRelation(relation: Relation, into: Set<string>): void {
	into.add(relation.collection);

	if (relation.related_collection) {
		into.add(relation.related_collection);
	}

	if (relation.meta?.one_allowed_collections) {
		for (const c of relation.meta.one_allowed_collections) {
			into.add(c);
		}
	}
}

function addCollectionsFromRelationRow(row: RelationMetaRow, into: Set<string>): void {
	into.add(row.many_collection);

	if (row.one_collection) {
		into.add(row.one_collection);
	}

	const allowed = row.one_allowed_collections;

	if (Array.isArray(allowed)) {
		for (const c of allowed) {
			if (typeof c === 'string') {
				into.add(c);
			}
		}
	}
}

function getCollectionsTouchedByFieldRelation(
	schema: SchemaOverview,
	collection: string,
	field: string,
	metaRows: RelationMetaRow[],
): Set<string> {
	const touched = new Set<string>();

	for (const rel of getRelations(schema.relations, collection, field)) {
		addCollectionsFromSchemaRelation(rel, touched);
	}

	for (const row of metaRows) {
		const matchesManySide = row.many_collection === collection && row.many_field === field;
		const matchesOneSide = row.one_collection === collection && row.one_field === field;

		if (matchesManySide || matchesOneSide) {
			addCollectionsFromRelationRow(row, touched);
		}
	}

	return touched;
}

function touchesExcludedTargetCollection(
	touchedCollections: Set<string>,
	currentCollection: string,
	excludedSet: Set<string>,
): boolean {
	for (const name of touchedCollections) {
		if (name !== currentCollection && excludedSet.has(name)) {
			return true;
		}
	}

	return false;
}

async function getExcludedSet(knex: Knex): Promise<Set<string>> {
	const excludedRows = (await knex.select('collection').from('directus_collections').where('excluded', true)) as {
		collection: string;
	}[];

	return new Set(excludedRows.map((r) => r.collection));
}

export async function getExcludedRelationalFieldsForCollection(
	collection: string,
	schema: SchemaOverview,
	knex: Knex,
): Promise<string[]> {
	const excludedSet = await getExcludedSet(knex);

	if (excludedSet.size === 0) {
		return [];
	}

	const relationalFields = Object.keys(schema.collections[collection]?.fields ?? {}).filter((field) =>
		isRelationalField(schema, collection, field),
	);

	if (relationalFields.length === 0) {
		return [];
	}

	const metaRows = (await knex('directus_relations')
		.select('many_collection', 'many_field', 'one_collection', 'one_field', 'one_allowed_collections')
		.where((qb) => {
			for (const f of relationalFields) {
				qb.orWhere((inner) => {
					inner.where({ many_collection: collection, many_field: f });
				});

				qb.orWhere((inner) => {
					inner.where({ one_collection: collection, one_field: f });
				});
			}
		})) as RelationMetaRow[];

	const excludedFields: string[] = [];

	for (const field of relationalFields) {
		const touchedCollections = getCollectionsTouchedByFieldRelation(schema, collection, field, metaRows);

		if (touchedCollections.size === 0) {
			continue;
		}

		if (touchesExcludedTargetCollection(touchedCollections, collection, excludedSet)) {
			excludedFields.push(field);
		}
	}

	return excludedFields;
}

/**
 * Reject field paths whose relation graph references an excluded collection (directus_collections.excluded),
 * using the same error shape as unknown fields.
 */
export async function validateRelationalFieldsToExcludedCollections(
	fieldMap: FieldMap,
	schema: SchemaOverview,
	knex: Knex,
): Promise<void> {
	const excludedSet = await getExcludedSet(knex);

	if (excludedSet.size === 0) {
		return;
	}

	const pairKeys = new Set<string>();

	for (const [, { collection, fields }] of [...fieldMap.read.entries(), ...fieldMap.other.entries()]) {
		for (const field of fields) {
			if (isRelationalField(schema, collection, field)) {
				pairKeys.add(`${collection}\x00${field}`);
			}
		}
	}

	const pairs = [...pairKeys].map((key) => {
		const sep = key.indexOf('\x00');
		return [key.slice(0, sep), key.slice(sep + 1)] as [string, string];
	});

	let metaRows: RelationMetaRow[] = [];

	if (pairs.length > 0) {
		metaRows = (await knex('directus_relations')
			.select('many_collection', 'many_field', 'one_collection', 'one_field', 'one_allowed_collections')
			.where((qb) => {
				for (const [c, f] of pairs) {
					qb.orWhere((inner) => {
						inner.where({ many_collection: c, many_field: f });
					});

					qb.orWhere((inner) => {
						inner.where({ one_collection: c, one_field: f });
					});
				}
			})) as RelationMetaRow[];
	}

	for (const [path, { collection, fields }] of [...fieldMap.read.entries(), ...fieldMap.other.entries()]) {
		const invalidFields: string[] = [];

		for (const field of fields) {
			if (!isRelationalField(schema, collection, field)) {
				continue;
			}

			const touchedCollections = getCollectionsTouchedByFieldRelation(schema, collection, field, metaRows);

			if (touchedCollections.size === 0) {
				continue;
			}

			if (touchesExcludedTargetCollection(touchedCollections, collection, excludedSet)) {
				invalidFields.push(field);
			}
		}

		if (invalidFields.length > 0) {
			throw createFieldsForbiddenError(path, collection, invalidFields);
		}
	}
}

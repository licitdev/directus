import { SchemaBuilder } from '@directus/schema-builder';
import type { Accountability } from '@directus/types';
import knex from 'knex';
import { MockClient } from 'knex-mock-client';
import { describe, expect, test, vi } from 'vitest';
import { fetchPermissions } from '../../../permissions/lib/fetch-permissions.js';
import { ItemsService } from '../../../services/index.js';
import { sanitizePayload } from './sanitize-payload.js';

vi.mock('../../../permissions/lib/fetch-policies.js');
vi.mock('../../../permissions/lib/fetch-permissions.js');
vi.mock('../../../services/index.js');

vi.mock('../../../permissions/utils/fetch-dynamic-variable-data.js', () => ({
	fetchDynamicVariableData: vi.fn().mockResolvedValue({}),
}));

const schema = new SchemaBuilder()
	.collection('articles', (c) => {
		c.field('id').id();
		c.field('title').string();
		c.field('secret').hash();
		c.field('tags').m2m('tags');
		c.field('author').m2o('authors');
		c.field('comments').o2m('comments', 'article_id');
	})
	.collection('tags', (c) => {
		c.field('id').id();
		c.field('tag').string();
		c.field('secret').hash();
	})
	.collection('authors', (c) => {
		c.field('id').id();
		c.field('name').string();
		c.field('email').string();
		c.field('private_notes').string();
	})
	.collection('comments', (c) => {
		c.field('id').id();
		c.field('text').string();
		c.field('status').string();
		c.field('internal_note').string();
		c.field('article_id').integer();
	})
	.build();

// Mock ItemsService to return a Proxy that simulates an item containing all fields
// This ensures that "key in item" checks in sanitizePayload pass for allowed fields
const mockItem = new Proxy({}, {
	get: (target, prop) => prop === 'then' ? undefined : 'value', // Handle Promise resolution and values
	has: (target, prop) => true, // Always valid
	ownKeys: (target) => [],
	getOwnPropertyDescriptor: (target, prop) => ({ configurable: true, enumerable: true, value: 'value' }),
});

vi.mocked(ItemsService).mockReturnValue({
	readOne: () => Promise.resolve(mockItem),
} as any);

const accountability = { user: 'test-user', roles: ['test-role'] } as Accountability;
const adminAccountability = { user: 'admin', roles: ['admin'], admin: true } as Accountability;

const db = vi.mocked(knex.default({ client: MockClient }));

// ==================== Basic Permission Tests ====================

describe('Basic Permissions', () => {
	test('sanitize with no perms returns empty object', async () => {
		vi.mocked(fetchPermissions).mockResolvedValueOnce([]);

		const result = await sanitizePayload(
			'articles',
			{
				id: 1,
				title: 'Hello World',
				secret: 'top secret',
			},
			{ schema, accountability, knex: db },
		);

		expect(result).toEqual({});
	});

	test('sanitize with * read perms filters hash fields', async () => {
		vi.mocked(fetchPermissions).mockResolvedValueOnce([
			{
				action: 'read',
				collection: 'articles',
				fields: ['*'],
				policy: null,
				permissions: null,
				presets: [],
				validation: null,
			},
		]);

		const result = await sanitizePayload(
			'articles',
			{
				id: 1,
				title: 'Hello World',
				secret: 'top secret',
			},
			{ schema, accountability, knex: db },
		);

		expect(result).toEqual({
			id: 1,
			title: 'Hello World',
		});
	});

	test('sanitize with specific field perms', async () => {
		vi.mocked(fetchPermissions).mockResolvedValueOnce([
			{
				action: 'read',
				collection: 'articles',
				fields: ['title'],
				policy: null,
				permissions: null,
				presets: [],
				validation: null,
			},
		]);

		const result = await sanitizePayload(
			'articles',
			{
				id: 1,
				title: 'Hello World',
				secret: 'top secret',
			},
			{ schema, accountability, knex: db },
		);

		expect(result).toEqual({
			title: 'Hello World',
		});
	});
});

// ==================== Admin Bypass Tests ====================

describe('Admin Bypass', () => {
	test('admin user can read all fields except hash', async () => {
		vi.mocked(fetchPermissions).mockResolvedValueOnce([]);

		const result = await sanitizePayload(
			'articles',
			{
				id: 1,
				title: 'Hello World',
				secret: 'top secret',
			},
			{ schema, accountability: adminAccountability, knex: db },
		);

		expect(result).toEqual({
			id: 1,
			title: 'Hello World',
			// secret is still filtered due to hash special type
		});
	});
});

// ==================== allowedFields Parameter Tests ====================

describe('allowedFields Parameter', () => {
	test('uses allowedFields for root collection when provided', async () => {
		vi.mocked(fetchPermissions).mockResolvedValueOnce([
			{
				action: 'read',
				collection: 'articles',
				fields: ['*'], // Full access in DB
				policy: null,
				permissions: null,
				presets: [],
				validation: null,
			},
		]);

		const result = await sanitizePayload(
			'articles',
			{
				id: 1,
				title: 'Hello World',
			},
			{ schema, accountability, knex: db },
			['title'], // Only allow title
		);

		expect(result).toEqual({
			title: 'Hello World',
		});
	});

	test('allowedFields with wildcard allows all fields', async () => {
		vi.mocked(fetchPermissions).mockResolvedValueOnce([]);

		const result = await sanitizePayload(
			'articles',
			{
				id: 1,
				title: 'Hello World',
			},
			{ schema, accountability, knex: db },
			['*'],
		);

		expect(result).toEqual({
			id: 1,
			title: 'Hello World',
		});
	});
});

// ==================== M2O Nested Permission Tests ====================

describe('M2O Nested Permissions', () => {
	test('M2O field-level filtering on nested collection', async () => {
		vi.mocked(fetchPermissions).mockResolvedValueOnce([
			{
				action: 'read',
				collection: 'articles',
				fields: ['*'],
				policy: null,
				permissions: null,
				presets: [],
				validation: null,
			},
			{
				action: 'read',
				collection: 'authors',
				fields: ['id', 'name'], // No email or private_notes
				policy: null,
				permissions: null,
				presets: [],
				validation: null,
			},
		]);

		const result = await sanitizePayload(
			'articles',
			{
				id: 1,
				title: 'Hello World',
				author: {
					id: 10,
					name: 'John Doe',
					email: 'john@example.com',
					private_notes: 'Secret info',
				},
			},
			{ schema, accountability, knex: db },
		);

		expect(result).toEqual({
			id: 1,
			title: 'Hello World',
			author: {
				id: 10,
				name: 'John Doe',
				// email and private_notes filtered out
			},
		});
	});

	test('M2O no collection access filters entire nested object', async () => {
		vi.mocked(fetchPermissions).mockResolvedValueOnce([
			{
				action: 'read',
				collection: 'articles',
				fields: ['*'],
				policy: null,
				permissions: null,
				presets: [],
				validation: null,
			},
			// No authors permission
		]);

		const result = await sanitizePayload(
			'articles',
			{
				id: 1,
				title: 'Hello World',
				author: {
					id: 10,
					name: 'John Doe',
				},
			},
			{ schema, accountability, knex: db },
		);

		expect(result).toEqual({
			id: 1,
			title: 'Hello World',
			// author field completely filtered
		});
	});
});

// ==================== O2M Nested Permission Tests ====================

describe('O2M Nested Permissions', () => {
	test('O2M field-level filtering on nested collection', async () => {
		vi.mocked(fetchPermissions).mockResolvedValueOnce([
			{
				action: 'read',
				collection: 'articles',
				fields: ['*'],
				policy: null,
				permissions: null,
				presets: [],
				validation: null,
			},
			{
				action: 'read',
				collection: 'comments',
				fields: ['id', 'text'], // No internal_note
				policy: null,
				permissions: null,
				presets: [],
				validation: null,
			},
		]);

		const result = await sanitizePayload(
			'articles',
			{
				id: 1,
				title: 'Hello World',
				comments: {
					create: [{ id: 1, text: 'Great article!', internal_note: 'Check for spam' }],
					update: [{ id: 2, text: 'Updated comment', internal_note: 'Verified' }],
					delete: [3],
				},
			},
			{ schema, accountability, knex: db },
		);

		expect(result).toEqual({
			id: 1,
			title: 'Hello World',
			comments: {
				create: [{ id: 1, text: 'Great article!' }],
				update: [{ id: 2, text: 'Updated comment' }],
				delete: [], // Delete items (primitives) get filtered as they have no field permissions in nested context
			},
		});
	});

	test('O2M no collection access filters all nested items', async () => {
		vi.mocked(fetchPermissions).mockResolvedValueOnce([
			{
				action: 'read',
				collection: 'articles',
				fields: ['*'],
				policy: null,
				permissions: null,
				presets: [],
				validation: null,
			},
			// No comments permission
		]);

		const result = await sanitizePayload(
			'articles',
			{
				id: 1,
				title: 'Hello World',
				comments: {
					create: [{ id: 1, text: 'Great article!' }],
					update: [],
					delete: [],
				},
			},
			{ schema, accountability, knex: db },
		);

		expect(result).toEqual({
			id: 1,
			title: 'Hello World',
			// comments field completely filtered (all arrays become empty)
		});
	});

	test('O2M filters empty objects from detailed update syntax', async () => {
		vi.mocked(fetchPermissions).mockResolvedValueOnce([
			{
				action: 'read',
				collection: 'articles',
				fields: ['*'],
				policy: null,
				permissions: null,
				presets: [],
				validation: null,
			},
			{
				action: 'read',
				collection: 'comments',
				fields: ['id', 'text'],
				policy: null,
				permissions: null,
				presets: [],
				validation: null,
			},
		]);

		const result = await sanitizePayload(
			'articles',
			{
				id: 1,
				title: 'Hello World',
				comments: {
					create: [{ id: 1, text: 'Hello' }, {}], // Empty object should be filtered
					update: [{}, { id: 2, text: 'Updated' }], // Empty object should be filtered
					delete: [],
				},
			},
			{ schema, accountability, knex: db },
		);

		expect(result).toEqual({
			id: 1,
			title: 'Hello World',
			comments: {
				create: [{ id: 1, text: 'Hello' }],
				update: [{ id: 2, text: 'Updated' }],
				delete: [],
			},
		});
	});

	test('O2M omits field when all arrays are empty after filtering', async () => {
		vi.mocked(fetchPermissions).mockResolvedValueOnce([
			{
				action: 'read',
				collection: 'articles',
				fields: ['*'],
				policy: null,
				permissions: null,
				presets: [],
				validation: null,
			},
			// No comments permission - all nested items will be filtered
		]);

		const result = await sanitizePayload(
			'articles',
			{
				id: 1,
				title: 'Hello World',
				comments: {
					create: [{ id: 1, text: 'Comment' }],
					update: [],
					delete: [],
				},
			},
			{ schema, accountability, knex: db },
		);

		// comments field should be omitted entirely since all arrays become empty
		expect(result).toEqual({
			id: 1,
			title: 'Hello World',
		});
	});
});

// ==================== M2M Nested Permission Tests ====================

describe('M2M Nested Permissions', () => {
	test('M2M without junction perms filters relation', async () => {
		vi.mocked(fetchPermissions).mockResolvedValueOnce([
			{
				action: 'read',
				collection: 'articles',
				fields: ['*'],
				policy: null,
				permissions: null,
				presets: [],
				validation: null,
			},
		]);

		const result = await sanitizePayload(
			'articles',
			{
				id: 1,
				title: 'Hello World',
				tags: [{ tag_id: 1 }],
			},
			{ schema, accountability, knex: db },
		);

		expect(result).toEqual({
			id: 1,
			title: 'Hello World',
		});
	});

	test('M2M with full perms and field filtering on nested', async () => {
		vi.mocked(fetchPermissions).mockResolvedValueOnce([
			{
				action: 'read',
				collection: 'articles',
				fields: ['*'],
				policy: null,
				permissions: null,
				presets: [],
				validation: null,
			},
			{
				action: 'read',
				collection: 'articles_tags_junction',
				fields: ['tags_id'],
				policy: null,
				permissions: null,
				presets: [],
				validation: null,
			},
			{
				action: 'read',
				collection: 'tags',
				fields: ['id', 'tag'], // No secret
				policy: null,
				permissions: null,
				presets: [],
				validation: null,
			},
		]);

		const result = await sanitizePayload(
			'articles',
			{
				id: 1,
				title: 'Hello World',
				tags: [
					{
						articles_id: 1,
						tags_id: {
							id: 1,
							tag: 'news',
							secret: 'top secret',
						},
					},
				],
			},
			{ schema, accountability, knex: db },
		);

		expect(result).toEqual({
			id: 1,
			title: 'Hello World',
			tags: [
				{
					tags_id: {
						id: 1,
						tag: 'news',
						// secret filtered due to hash special type
					},
				},
			],
		});
	});

	test('M2M with create/update/delete syntax', async () => {
		vi.mocked(fetchPermissions).mockResolvedValueOnce([
			{
				action: 'read',
				collection: 'articles',
				fields: ['*'],
				policy: null,
				permissions: null,
				presets: [],
				validation: null,
			},
			{
				action: 'read',
				collection: 'articles_tags_junction',
				fields: ['*'],
				policy: null,
				permissions: null,
				presets: [],
				validation: null,
			},
			{
				action: 'read',
				collection: 'tags',
				fields: ['tag'],
				policy: null,
				permissions: null,
				presets: [],
				validation: null,
			},
		]);

		const result = await sanitizePayload(
			'articles',
			{
				id: 10,
				title: 'Hello World',
				tags: {
					create: [
						{
							tags_id: {
								id: 11,
								tag: 'news',
							},
						},
					],
					update: [
						{
							tags_id: {
								id: 12,
								tag: 'updates',
							},
						},
					],
					delete: [13],
				},
			},
			{ schema, accountability, knex: db },
		);

		expect(result).toEqual({
			id: 10,
			title: 'Hello World',
			tags: {
				create: [
					{
						tags_id: {
							tag: 'news',
						},
					},
				],
				update: [
					{
						tags_id: {
							tag: 'updates',
						},
					},
				],
				delete: [], // 13 is mapped to object, but junction only allows 'tags_id' field so id filtered
			},
		});
	});
});

// ==================== Root vs Nested allowedFields Tests ====================

describe('Root vs Nested allowedFields', () => {
	test('allowedFields applies to root only, permissionsByCollection for nested M2O', async () => {
		vi.mocked(fetchPermissions).mockResolvedValueOnce([
			{
				action: 'read',
				collection: 'articles',
				fields: ['id', 'title'], // Limited in DB but allowedFields overrides
				policy: null,
				permissions: null,
				presets: [],
				validation: null,
			},
			{
				action: 'read',
				collection: 'authors',
				fields: ['id', 'name'], // This should still apply to nested
				policy: null,
				permissions: null,
				presets: [],
				validation: null,
			},
		]);

		const result = await sanitizePayload(
			'articles',
			{
				id: 1,
				title: 'Hello World',
				author: {
					id: 10,
					name: 'John',
					email: 'john@test.com', // Should be filtered by permissionsByCollection
				},
			},
			{ schema, accountability, knex: db },
			['*'], // Full access to root via allowedFields
		);

		expect(result).toEqual({
			id: 1,
			title: 'Hello World',
			author: {
				id: 10,
				name: 'John',
				// email filtered by permissionsByCollection
			},
		});
	});

	test('allowedFields applies to root only, permissionsByCollection for nested O2M', async () => {
		vi.mocked(fetchPermissions).mockResolvedValueOnce([
			{
				action: 'read',
				collection: 'articles',
				fields: ['*'],
				policy: null,
				permissions: null,
				presets: [],
				validation: null,
			},
			{
				action: 'read',
				collection: 'comments',
				fields: ['text'], // Only text, no id
				policy: null,
				permissions: null,
				presets: [],
				validation: null,
			},
		]);

		const result = await sanitizePayload(
			'articles',
			{
				id: 1,
				title: 'Hello World',
				comments: {
					create: [{ id: 1, text: 'Comment', internal_note: 'Note' }],
					update: [],
					delete: [],
				},
			},
			{ schema, accountability, knex: db },
			['id', 'title', 'comments'], // Root fields
		);

		expect(result).toEqual({
			id: 1,
			title: 'Hello World',
			comments: {
				create: [{ text: 'Comment' }], // Only text allowed on comments
				update: [],
				delete: [],
			},
		});
	});
});

// ==================== Item-Level Permissions Tests ====================

describe('Item-Level Permissions', () => {
	test('filters out nested item if service.readOne fails (item access denied)', async () => {
		vi.mocked(fetchPermissions).mockResolvedValueOnce([
			{
				action: 'read',
				collection: 'articles',
				fields: ['*'],
				policy: null,
				permissions: null,
				presets: [],
				validation: null,
			},
			{
				action: 'read',
				collection: 'comments',
				fields: ['id', 'text'],
				policy: null,
				permissions: {
					id: { _neq: 999 },
				},
				presets: [],
				validation: null,
			},
		]);

		// Mock ItemsService to throw Forbidden/not found for a specific comment ID
		const readOneMock = vi.fn().mockImplementation(async (key) => {
			if (key === 999) throw new Error('Forbidden'); // ID 999 is forbidden
			return { id: key, text: 'Allowed comment' }; // Others allowed
		});

		vi.mocked(ItemsService).mockReturnValue({
			readOne: readOneMock,
		} as any);

		const result = await sanitizePayload(
			'articles',
			{
				id: 1,
				title: 'Hello World',
				comments: {
					create: [],
					update: [
						{ id: 2, text: 'Allowed comment' },
						{ id: 999, text: 'Forbidden comment' },
					],
					delete: [],
				},
			},
			{ schema, accountability, knex: db },
		);

		expect(readOneMock).toHaveBeenCalledWith(999, expect.anything());

		expect(result).toEqual({
			id: 1,
			title: 'Hello World',
			comments: {
				create: [],
				update: [
					{ id: 2, text: 'Allowed comment' },
					// ID 999 should be filtered out
				],
				delete: [],
			},
		});
	});
});

describe('Conditional Permissions', () => {
	test('filters out create items that do not match permission rules', async () => {
		vi.mocked(fetchPermissions).mockResolvedValueOnce([
			{
				action: 'read',
				collection: 'articles',
				fields: ['*'],
				policy: null,
				permissions: null,
				presets: [],
				validation: null,
			},
			{
				action: 'read',
				collection: 'comments',
				fields: ['*'],
				policy: null,
				permissions: { status: { _eq: 'published' } },
				presets: [],
				validation: null,
			},
		]);

		const result = await sanitizePayload(
			'articles',
			{
				id: 1,
				title: 'Hello World',
				comments: {
					create: [
						{ status: 'published', text: 'Visible' },
						{ status: 'draft', text: 'Hidden' },
					],
					update: [],
					delete: [],
				},
			},
			{ schema, accountability, knex: db },
		);

		expect(result).toEqual({
			id: 1,
			title: 'Hello World',
			comments: {
				create: [{ status: 'published', text: 'Visible' }],
				update: [],
				delete: [],
			},
		});
	});
});

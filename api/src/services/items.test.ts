import { SchemaBuilder } from '@directus/schema-builder';
import { UserIntegrityCheckFlag } from '@directus/types';
import knex, { type Knex } from 'knex';
import { createTracker, MockClient, Tracker } from 'knex-mock-client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, type MockedFunction, test, vi } from 'vitest';
import { getDatabaseClient } from '../database/index.js';
import { validateUserCountIntegrity } from '../utils/validate-user-count-integrity.js';
import { handleVersion } from '../utils/versioning/handle-version.js';
import { CollectionsService } from './collections.js';
import { ItemsService } from './index.js';

vi.mock('@directus/schema', async () => {
	const { mockSchema } = await import('../test-utils/schema.js');
	return mockSchema();
});

vi.mock('../../src/database/index', () => ({
	default: vi.fn(),
	getDatabaseClient: vi.fn().mockReturnValue('postgres'),
}));

vi.mock('../utils/validate-user-count-integrity.js');
vi.mock('../utils/versioning/handle-version.js', { spy: true });

const schema = new SchemaBuilder()
	.collection('test', (c) => {
		c.field('id').id();
	})
	.collection('directus_users', (c) => {
		c.field('id').uuid().primary();
	})
	.collection('directus_versions', (c) => {
		c.field('id').id();
		c.field('item').string();
		c.field('collection').string();
		c.field('key').string();
	})
	.build();

describe('Integration Tests', () => {
	let db: MockedFunction<Knex>;
	let tracker: Tracker;

	beforeAll(async () => {
		db = vi.mocked(knex.default({ client: MockClient }));
		tracker = createTracker(db);
	});

	beforeEach(() => {
		tracker.on.any('test').response({});
	});

	afterEach(() => {
		tracker.reset();
	});

	describe('Services / Items', () => {
		let service: ItemsService;

		beforeEach(() => {
			vi.spyOn(CollectionsService.prototype, 'isExcluded').mockResolvedValue(false);

			service = new ItemsService('test', {
				knex: db,
				schema,
			});
		});

		afterEach(() => {
			vi.clearAllMocks();
		});

		describe('read with version "test"', () => {
			test('on readOne', async () => {
				vi.mocked(handleVersion).mockReturnValueOnce(new Promise((resolve) => resolve([{ id: 1 }])));

				await service.readOne(1, { version: 'test' });

				expect(handleVersion).toHaveBeenCalled();
			});

			test('on readSingleton', async () => {
				vi.mocked(handleVersion).mockReturnValueOnce(new Promise((resolve) => resolve([{ id: 1 }])));

				vi.spyOn(db, 'select').mockReturnValueOnce({
					from: () => ({
						first: async () => ({ id: 1 }),
					}),
				} as any);

				await service.readSingleton({ version: 'test' });

				expect(handleVersion).toHaveBeenCalled();
			});
		});

		describe('read with version "main"', () => {
			test('on readOne', async () => {
				service.readByQuery = vi.fn(async () => [{ id: 1 }]);

				await service.readOne(1, { version: 'main' });

				expect(handleVersion).not.toHaveBeenCalled();
			});

			test('on readSingleton', async () => {
				service.readByQuery = vi.fn(async () => [{ id: 1 }]);

				await service.readSingleton({ version: 'main' });

				expect(handleVersion).not.toHaveBeenCalled();
			});
		});

		describe('createOne', () => {
			it('should validate user count if requested', async () => {
				await service.createOne({}, { userIntegrityCheckFlags: UserIntegrityCheckFlag.All });

				expect(validateUserCountIntegrity).toHaveBeenCalled();
			});

			it('should use includeTriggerModifications for MS SQL', async () => {
				vi.mocked(getDatabaseClient).mockReturnValue('mssql');

				const mockReturning = vi.fn().mockResolvedValue([{ id: 1 }]);

				const mockQuery = {
					insert: vi.fn().mockReturnThis(),
					into: vi.fn().mockReturnThis(),
					returning: mockReturning,
				};

				const transactionSpy = vi.spyOn(db, 'transaction').mockImplementation(async (callback) => {
					const trx = { ...db, ...mockQuery };
					return await callback(trx as any);
				});

				await service.createOne({ name: 'Test' });

				expect(mockReturning).toHaveBeenCalledWith('id', { includeTriggerModifications: true });

				transactionSpy.mockRestore();
			});

			it('should not use includeTriggerModifications for non-MS SQL', async () => {
				vi.mocked(getDatabaseClient).mockReturnValue('postgres');

				const mockReturning = vi.fn().mockResolvedValue([{ id: 1 }]);

				const mockQuery = {
					insert: vi.fn().mockReturnThis(),
					into: vi.fn().mockReturnThis(),
					returning: mockReturning,
				};

				const transactionSpy = vi.spyOn(db, 'transaction').mockImplementation(async (callback) => {
					const trx = { ...db, ...mockQuery };
					return await callback(trx as any);
				});

				await service.createOne({ name: 'Test' });

				expect(mockReturning).toHaveBeenCalledWith('id', undefined);

				transactionSpy.mockRestore();
			});
		});

		describe('createMany', () => {
			it('should validate user count if requested', async () => {
				await service.createMany([{}], { userIntegrityCheckFlags: UserIntegrityCheckFlag.All });

				expect(validateUserCountIntegrity).toHaveBeenCalled();
			});
		});

		describe('updateBatch', () => {
			it('should validate user count if requested', async () => {
				await service.updateBatch([{ id: 1 }], { userIntegrityCheckFlags: UserIntegrityCheckFlag.All });

				expect(validateUserCountIntegrity).toHaveBeenCalled();
			});
		});

		describe('updateMany', () => {
			it('should validate user count if requested', async () => {
				await service.updateMany([1], {}, { userIntegrityCheckFlags: UserIntegrityCheckFlag.All });

				expect(validateUserCountIntegrity).toHaveBeenCalled();
			});
		});

		describe('deleteMany', () => {
			it('should validate user count if requested', async () => {
				await service.deleteMany([1], { userIntegrityCheckFlags: UserIntegrityCheckFlag.All });

				expect(validateUserCountIntegrity).toHaveBeenCalled();
			});
		});

		describe('excluded collection', () => {
			beforeEach(() => {
				vi.spyOn(CollectionsService.prototype, 'isExcluded').mockResolvedValue(true);
			});

			test.each([
				['createMany', () => service.createMany([{}])],
				['readOne', () => service.readOne(1)],
				['readMany', () => service.readMany([1])],
				['updateByQuery', () => service.updateByQuery({}, {})],
				['updateOne', () => service.updateOne(1, {})],
				['updateBatch', () => service.updateBatch([{ id: 1 }])],
				['upsertOne', () => service.upsertOne({})],
				['upsertMany', () => service.upsertMany([{}])],
				['deleteByQuery', () => service.deleteByQuery({})],
				['deleteOne', () => service.deleteOne(1)],
				['upsertSingleton', () => service.upsertSingleton({})],
			] as const)('throws when collection is excluded (%s)', async (_name, invoke) => {
				await expect(invoke()).rejects.toThrow(/excluded/i);
			});
		});

		describe('system collections', () => {
			const userId = '123e4567-e89b-12d3-a456-426614174000';

			let systemItemsService: ItemsService;

			beforeEach(() => {
				vi.spyOn(CollectionsService.prototype, 'isExcluded').mockResolvedValue(true);

				systemItemsService = new ItemsService('directus_users', {
					knex: db,
					schema,
				});
			});

			it('does not call isExcluded when reading a system collection (assertCollectionNotExcluded short-circuits)', async () => {
				const isExcludedSpy = vi.spyOn(CollectionsService.prototype, 'isExcluded').mockResolvedValue(true);
				systemItemsService.readByQuery = vi.fn(async () => [{ id: userId }]);

				await systemItemsService.readOne(userId, { version: 'main' });

				expect(isExcludedSpy).not.toHaveBeenCalled();
			});

			it('does not throw excluded error for system collection when isExcluded would be true', async () => {
				vi.spyOn(CollectionsService.prototype, 'isExcluded').mockResolvedValue(true);
				systemItemsService.readByQuery = vi.fn(async () => [{ id: userId }]);

				await expect(systemItemsService.readOne(userId, { version: 'main' })).resolves.toEqual({
					id: userId,
				});
			});
		});
	});
});

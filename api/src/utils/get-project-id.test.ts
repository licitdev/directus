import type { Knex } from 'knex';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { getDatabase } from '../database/index.js';
import { getProjectId } from './get-project-id.js';

vi.mock('../database/index.js');

function createDbMock() {
	const first = vi.fn();

	const db = Object.assign(vi.fn(), {
		select: vi.fn().mockReturnThis(),
		from: vi.fn().mockReturnThis(),
		first,
	}) as unknown as Knex;

	return { db, first };
}

describe('getProjectId', () => {
	afterEach(() => {
		vi.clearAllMocks();
	});

	test('returns project_id from first row of directus_settings', async () => {
		const { db, first } = createDbMock();
		first.mockResolvedValue({ project_id: 'my-project-uuid' });
		vi.mocked(getDatabase).mockReturnValue(db);

		const result = await getProjectId();

		expect(getDatabase).toHaveBeenCalledOnce();
		expect(db.select).toHaveBeenCalledWith('project_id');
		expect(db.from).toHaveBeenCalledWith('directus_settings');
		expect(first).toHaveBeenCalledOnce();
		expect(result).toBe('my-project-uuid');
	});

	test('returns undefined when first row has no project_id', async () => {
		const { db, first } = createDbMock();
		first.mockResolvedValue({ project_id: null });
		vi.mocked(getDatabase).mockReturnValue(db);

		const result = await getProjectId();

		expect(result).toBeUndefined();
	});

	test('returns undefined when no row exists', async () => {
		const { db, first } = createDbMock();
		first.mockResolvedValue(undefined);
		vi.mocked(getDatabase).mockReturnValue(db);

		const result = await getProjectId();

		expect(result).toBeUndefined();
	});
});

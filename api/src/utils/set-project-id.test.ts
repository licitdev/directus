import type { Knex } from 'knex';
import { afterEach, beforeAll, describe, expect, test, vi } from 'vitest';
import { getDatabase } from '../database/index.js';
import * as loggerModule from '../logger/index.js';
import { setProjectId } from './set-project-id.js';

vi.mock('../database/index.js');

vi.mock('../logger/index.js', () => ({
	useLogger: vi.fn().mockReturnValue({ warn: vi.fn() }),
}));

let loggerRef: { warn: ReturnType<typeof vi.fn> };

function createDbMock() {
	const first = vi.fn();
	const where = vi.fn().mockResolvedValue(undefined);
	const update = vi.fn().mockReturnValue({ where });

	const db = Object.assign(vi.fn().mockReturnValue({ update }), {
		select: vi.fn().mockReturnThis(),
		from: vi.fn().mockReturnThis(),
		first,
	}) as unknown as Knex;

	return { db, first, where, update };
}

describe('setProjectId', () => {
	beforeAll(() => {
		loggerRef = vi.mocked(loggerModule.useLogger).mock.results[0]!.value as { warn: ReturnType<typeof vi.fn> };
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	test('updates project_id on first row of directus_settings', async () => {
		const { db, first, where, update } = createDbMock();
		first.mockResolvedValue({ id: 'settings-row-id' });
		vi.mocked(getDatabase).mockReturnValue(db);

		await setProjectId('new-project-uuid');

		expect(getDatabase).toHaveBeenCalledOnce();
		expect(db.select).toHaveBeenCalledWith('id');
		expect(db.from).toHaveBeenCalledWith('directus_settings');
		expect(first).toHaveBeenCalledOnce();
		expect(db).toHaveBeenCalledWith('directus_settings');
		expect(update).toHaveBeenCalledWith({ project_id: 'new-project-uuid' });
		expect(where).toHaveBeenCalledWith('id', 'settings-row-id');
	});

	test('logs and throws when directus_settings has no row', async () => {
		const { db, first } = createDbMock();
		first.mockResolvedValue(undefined);
		vi.mocked(getDatabase).mockReturnValue(db);

		await expect(setProjectId('new-project-uuid')).rejects.toThrow('Failed to set project_id');

		expect(loggerRef.warn).toHaveBeenCalledWith('Failed to set project_id: table directus_settings has no row');
	});

	test('throws when first row has no id', async () => {
		const { db, first } = createDbMock();
		first.mockResolvedValue({ id: null });
		vi.mocked(getDatabase).mockReturnValue(db);

		await expect(setProjectId('new-project-uuid')).rejects.toThrow('Failed to set project_id');

		expect(loggerRef.warn).toHaveBeenCalledWith('Failed to set project_id: table directus_settings has no row');
	});
});

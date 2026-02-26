import { afterEach, describe, expect, test, vi } from 'vitest';
import { getDatabase } from '../../database/index.js';
import { saveKey } from './save-key.js';

vi.mock('../../database/index.js');

function createDbMock() {
	const first = vi.fn();
	const where = vi.fn().mockResolvedValue(undefined);
	const update = vi.fn().mockReturnValue({ where });

	const db = Object.assign((_table: string) => ({ update }), {
		select: vi.fn().mockReturnThis(),
		from: vi.fn().mockReturnThis(),
		first,
	}) as unknown as ReturnType<typeof getDatabase>;

	return { db, first, where, update };
}

describe('saveKey', () => {
	afterEach(() => {
		vi.clearAllMocks();
	});

	test('updates directus_settings with license_key when project_id is provided', async () => {
		const { db, where, update } = createDbMock();
		vi.mocked(getDatabase).mockReturnValue(db);

		await saveKey('my-license-key', 'project-uuid');

		expect(db.select).not.toHaveBeenCalled();
		expect(db.from).not.toHaveBeenCalled();
		expect(update).toHaveBeenCalledWith({ license_key: 'my-license-key' });
		expect(where).toHaveBeenCalledWith({ project_id: 'project-uuid' });
	});

	test('loads project_id from directus_settings when project_id is not provided', async () => {
		const { db, first, where, update } = createDbMock();
		first.mockResolvedValue({ project_id: 'resolved-id' });
		vi.mocked(getDatabase).mockReturnValue(db);

		await saveKey('my-license-key');

		expect(db.select).toHaveBeenCalledWith('project_id');
		expect(db.from).toHaveBeenCalledWith('directus_settings');
		expect(first).toHaveBeenCalledOnce();
		expect(update).toHaveBeenCalledWith({ license_key: 'my-license-key' });
		expect(where).toHaveBeenCalledWith({ project_id: 'resolved-id' });
	});

	test('throws when project_id is not provided and first row has no project_id', async () => {
		const { db, first } = createDbMock();
		first.mockResolvedValue({ project_id: null });
		vi.mocked(getDatabase).mockReturnValue(db);

		await expect(saveKey('my-license-key')).rejects.toThrow('project_id is missing or not a string');
	});

	test('throws when project_id is not provided and first row is undefined', async () => {
		const { db, first } = createDbMock();
		first.mockResolvedValue(undefined);
		vi.mocked(getDatabase).mockReturnValue(db);

		await expect(saveKey('my-license-key')).rejects.toThrow('project_id is missing or not a string');
	});
});

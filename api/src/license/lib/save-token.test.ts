import { afterEach, describe, expect, test, vi } from 'vitest';
import { getDatabase } from '../../database/index.js';
import * as cacheTokenPayload from '../../utils/cache-token-payload.js';
import { verify } from '../../utils/verify-token.js';
import { saveToken } from './save-token.js';

vi.mock('../../database/index.js');
vi.mock('../../utils/verify-token.js');
vi.mock('../../utils/cache-token-payload.js');

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

describe('saveToken', () => {
	afterEach(() => {
		vi.clearAllMocks();
	});

	test('verifies token, updates directus_settings, and writes payload to cache when project_id is provided', async () => {
		const { db, where, update } = createDbMock();
		const payload = { plan: 'pro', metadata: {} };
		vi.mocked(getDatabase).mockReturnValue(db);
		vi.mocked(verify).mockResolvedValue(payload);

		await saveToken('jwt-token', 'project-uuid');

		expect(verify).toHaveBeenCalledWith('jwt-token');
		expect(db.select).not.toHaveBeenCalled();
		expect(db.from).not.toHaveBeenCalled();
		expect(update).toHaveBeenCalledWith({ license_token: 'jwt-token' });
		expect(where).toHaveBeenCalledWith({ project_id: 'project-uuid' });
		expect(cacheTokenPayload.writeCacheTokenPayload).toHaveBeenCalledWith(payload);
	});

	test('loads project_id from directus_settings and writes payload to cache when project_id is not provided', async () => {
		const { db, first, where } = createDbMock();
		const payload = { plan: 'pro', metadata: {} };
		first.mockResolvedValue({ project_id: 'resolved-id' });
		vi.mocked(getDatabase).mockReturnValue(db);
		vi.mocked(verify).mockResolvedValue(payload);

		await saveToken('jwt-token');

		expect(verify).toHaveBeenCalledWith('jwt-token');
		expect(db.select).toHaveBeenCalledWith('project_id');
		expect(db.from).toHaveBeenCalledWith('directus_settings');
		expect(first).toHaveBeenCalledOnce();
		expect(where).toHaveBeenCalledWith({ project_id: 'resolved-id' });
		expect(cacheTokenPayload.writeCacheTokenPayload).toHaveBeenCalledWith(payload);
	});

	test('throws when verify throws and does not call writeCacheTokenPayload', async () => {
		const { db } = createDbMock();
		vi.mocked(getDatabase).mockReturnValue(db);
		vi.mocked(verify).mockRejectedValue(new Error('invalid token'));

		await expect(saveToken('bad-token', 'project-uuid')).rejects.toThrow('invalid token');

		expect(cacheTokenPayload.writeCacheTokenPayload).not.toHaveBeenCalled();
	});

	test('throws when project_id is not provided and first row has no project_id', async () => {
		const { db, first } = createDbMock();
		first.mockResolvedValue({ project_id: null });
		vi.mocked(getDatabase).mockReturnValue(db);
		vi.mocked(verify).mockResolvedValue({});

		await expect(saveToken('jwt-token')).rejects.toThrow('project_id is missing or not a string');

		expect(cacheTokenPayload.writeCacheTokenPayload).not.toHaveBeenCalled();
	});

	test('throws when project_id is not provided and first row is undefined', async () => {
		const { db, first } = createDbMock();
		first.mockResolvedValue(undefined);
		vi.mocked(getDatabase).mockReturnValue(db);
		vi.mocked(verify).mockResolvedValue({});

		await expect(saveToken('jwt-token')).rejects.toThrow('project_id is missing or not a string');

		expect(cacheTokenPayload.writeCacheTokenPayload).not.toHaveBeenCalled();
	});
});

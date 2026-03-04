import type { Knex } from 'knex';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { getDatabase } from '../../database/index.js';
import * as encryptUtils from '../../utils/encrypt.js';
import * as getProjectIdUtils from '../../utils/get-project-id.js';
import * as getSecretUtils from '../../utils/get-secret.js';
import { saveKey } from './save-key.js';

vi.mock('../../database/index.js');
vi.mock('../../utils/encrypt.js');
vi.mock('../../utils/get-secret.js');
vi.mock('../../utils/get-project-id.js');

function createDbMock() {
	const where = vi.fn().mockResolvedValue(undefined);
	const update = vi.fn().mockReturnValue({ where });

	const db = Object.assign((_table: string) => ({ update }), {
		select: vi.fn().mockReturnThis(),
		from: vi.fn().mockReturnThis(),
		first: vi.fn(),
	}) as unknown as Knex;

	return { db, where, update };
}

describe('saveKey', () => {
	afterEach(() => {
		vi.clearAllMocks();
	});

	test('encrypts and updates directus_settings with license_key when project_id is provided', async () => {
		const { db, where, update } = createDbMock();
		vi.mocked(getDatabase).mockReturnValue(db);
		vi.mocked(getSecretUtils.getSecret).mockReturnValue('test-secret');
		vi.mocked(encryptUtils.encrypt).mockResolvedValue('encrypted-license-key');

		await saveKey('my-license-key', 'project-uuid');

		expect(getProjectIdUtils.getProjectId).not.toHaveBeenCalled();
		expect(getSecretUtils.getSecret).toHaveBeenCalled();
		expect(encryptUtils.encrypt).toHaveBeenCalledWith('my-license-key', 'test-secret');
		expect(update).toHaveBeenCalledWith({ license_key: 'encrypted-license-key' });
		expect(where).toHaveBeenCalledWith({ project_id: 'project-uuid' });
	});

	test('uses getProjectId, encrypts and updates directus_settings when project_id is not provided', async () => {
		const { db, where, update } = createDbMock();
		vi.mocked(getDatabase).mockReturnValue(db);
		vi.mocked(getProjectIdUtils.getProjectId).mockResolvedValue('resolved-id');
		vi.mocked(getSecretUtils.getSecret).mockReturnValue('test-secret');
		vi.mocked(encryptUtils.encrypt).mockResolvedValue('encrypted-license-key');

		await saveKey('my-license-key');

		expect(getProjectIdUtils.getProjectId).toHaveBeenCalledOnce();
		expect(encryptUtils.encrypt).toHaveBeenCalledWith('my-license-key', 'test-secret');
		expect(update).toHaveBeenCalledWith({ license_key: 'encrypted-license-key' });
		expect(where).toHaveBeenCalledWith({ project_id: 'resolved-id' });
	});

	test('throws when project_id is not provided and getProjectId returns null', async () => {
		const { db } = createDbMock();
		vi.mocked(getDatabase).mockReturnValue(db);
		vi.mocked(getProjectIdUtils.getProjectId).mockResolvedValue(undefined);

		await expect(saveKey('my-license-key')).rejects.toThrow('project_id is missing or not a string');
	});

	test('throws when project_id is not provided and getProjectId returns empty string', async () => {
		const { db } = createDbMock();
		vi.mocked(getDatabase).mockReturnValue(db);
		vi.mocked(getProjectIdUtils.getProjectId).mockResolvedValue('');

		await expect(saveKey('my-license-key')).rejects.toThrow('project_id is missing or not a string');
	});
});

import { useEnv } from '@directus/env';
import type { Knex } from 'knex';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { getDatabase } from '../../database/index.js';
import * as encryptUtils from '../../utils/encrypt.js';
import * as getSecretUtils from '../../utils/get-secret.js';
import { getKey } from './get-key.js';

vi.mock('@directus/env', () => ({ useEnv: vi.fn().mockReturnValue({}) }));
vi.mock('../../database/index.js');
vi.mock('../../utils/encrypt.js');
vi.mock('../../utils/get-secret.js');

function createDbMock() {
	const first = vi.fn();

	const db = {
		select: vi.fn().mockReturnThis(),
		from: vi.fn().mockReturnThis(),
		first,
	} as unknown as Knex;

	return { db, first };
}

describe('getKey', () => {
	afterEach(() => {
		vi.clearAllMocks();
	});

	test('returns DIRECTUS_LICENSE_KEY from env when it is a string', async () => {
		vi.mocked(useEnv).mockReturnValue({ DIRECTUS_LICENSE_KEY: 'env-license-key' });

		const result = await getKey();

		expect(result).toBe('env-license-key');
		expect(getDatabase).not.toHaveBeenCalled();
		expect(encryptUtils.decrypt).not.toHaveBeenCalled();
	});

	test('decrypts license_key from database and returns it when env key is not a string', async () => {
		vi.mocked(useEnv).mockReturnValue({});

		const { db, first } = createDbMock();
		first.mockResolvedValue({ license_key: 'encrypted-key' });
		vi.mocked(getDatabase).mockReturnValue(db);
		vi.mocked(getSecretUtils.getSecret).mockReturnValue('test-secret');
		vi.mocked(encryptUtils.decrypt).mockResolvedValue('plain-license-key');

		const result = await getKey();

		expect(getDatabase).toHaveBeenCalled();
		expect(db.select).toHaveBeenCalledWith('license_key');
		expect(db.from).toHaveBeenCalledWith('directus_settings');
		expect(first).toHaveBeenCalledOnce();
		expect(getSecretUtils.getSecret).toHaveBeenCalled();
		expect(encryptUtils.decrypt).toHaveBeenCalledWith('encrypted-key', 'test-secret');
		expect(result).toBe('plain-license-key');
	});

	test('returns undefined when env key is not set and db row has no license_key', async () => {
		vi.mocked(useEnv).mockReturnValue({});

		const { db, first } = createDbMock();
		first.mockResolvedValue({ license_key: null });
		vi.mocked(getDatabase).mockReturnValue(db);

		const result = await getKey();

		expect(encryptUtils.decrypt).not.toHaveBeenCalled();
		expect(result).toBeUndefined();
	});

	test('returns undefined when env key is not set and no settings row exists', async () => {
		vi.mocked(useEnv).mockReturnValue({});

		const { db, first } = createDbMock();
		first.mockResolvedValue(undefined);
		vi.mocked(getDatabase).mockReturnValue(db);

		const result = await getKey();

		expect(encryptUtils.decrypt).not.toHaveBeenCalled();
		expect(result).toBeUndefined();
	});

	test('returns undefined when env key is not set and license_key is not a string', async () => {
		vi.mocked(useEnv).mockReturnValue({});

		const { db, first } = createDbMock();
		first.mockResolvedValue({});
		vi.mocked(getDatabase).mockReturnValue(db);

		const result = await getKey();

		expect(encryptUtils.decrypt).not.toHaveBeenCalled();
		expect(result).toBeUndefined();
	});
});

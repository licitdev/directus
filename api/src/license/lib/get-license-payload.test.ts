import { InvalidLicenseTokenError } from '@directus/errors';
import type { Knex } from 'knex';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { getDatabase } from '../../database/index.js';
import { readCacheTokenPayload, writeCacheTokenPayload } from '../../utils/cache-token-payload.js';
import * as encryptUtils from '../../utils/encrypt.js';
import * as getSecretUtils from '../../utils/get-secret.js';
import { verify } from '../../utils/verify-token.js';
import { getLicensePayload } from './get-license-payload.js';

vi.mock('../../database/index.js');
vi.mock('../../utils/cache-token-payload.js');
vi.mock('../../utils/encrypt.js');
vi.mock('../../utils/get-secret.js');
vi.mock('../../utils/verify-token.js');

afterEach(() => {
	vi.clearAllMocks();
});

describe('getLicensePayload', () => {
	test('returns cached payload when available', async () => {
		const cachedPayload = { metadata: { entitlements: { featureA: {} } } };

		vi.mocked(readCacheTokenPayload).mockResolvedValue(cachedPayload);

		const result = await getLicensePayload();

		expect(result).toEqual(cachedPayload);
		expect(getDatabase).not.toHaveBeenCalled();
		expect(verify).not.toHaveBeenCalled();
		expect(writeCacheTokenPayload).not.toHaveBeenCalled();
	});

	test('decrypts token from database, verifies it, caches payload and returns it when cache is empty', async () => {
		vi.mocked(readCacheTokenPayload).mockResolvedValue(undefined);

		const first = vi.fn().mockResolvedValue({ license_token: 'encrypted-token' });

		const db = {
			select: vi.fn().mockReturnThis(),
			from: vi.fn().mockReturnThis(),
			first,
		} as unknown as Knex;

		vi.mocked(getDatabase).mockReturnValue(db);
		vi.mocked(getSecretUtils.getSecret).mockReturnValue('test-secret');
		vi.mocked(encryptUtils.decrypt).mockResolvedValue('jwt-token');

		const verifiedPayload = { plan: 'pro', metadata: {} };

		vi.mocked(verify).mockResolvedValue(verifiedPayload);

		const result = await getLicensePayload();

		expect(getDatabase).toHaveBeenCalled();
		expect(db.select).toHaveBeenCalledWith('license_token');
		expect(db.from).toHaveBeenCalledWith('directus_settings');
		expect(first).toHaveBeenCalled();
		expect(getSecretUtils.getSecret).toHaveBeenCalled();
		expect(encryptUtils.decrypt).toHaveBeenCalledWith('encrypted-token', 'test-secret');
		expect(verify).toHaveBeenCalledWith('jwt-token');
		expect(writeCacheTokenPayload).toHaveBeenCalledWith(verifiedPayload);
		expect(result).toEqual(verifiedPayload);
	});

	test('throws InvalidLicenseTokenError when token verification fails', async () => {
		vi.mocked(readCacheTokenPayload).mockResolvedValue(undefined);

		const first = vi.fn().mockResolvedValue({ license_token: 'encrypted-token' });

		const db = {
			select: vi.fn().mockReturnThis(),
			from: vi.fn().mockReturnThis(),
			first,
		} as unknown as Knex;

		vi.mocked(getDatabase).mockReturnValue(db);
		vi.mocked(getSecretUtils.getSecret).mockReturnValue('test-secret');
		vi.mocked(encryptUtils.decrypt).mockResolvedValue('jwt-token');
		vi.mocked(verify).mockRejectedValue(new Error('invalid token'));

		await expect(getLicensePayload()).rejects.toThrow(InvalidLicenseTokenError);

		expect(writeCacheTokenPayload).not.toHaveBeenCalled();
	});

	test('throws InvalidLicenseTokenError when decrypt fails', async () => {
		vi.mocked(readCacheTokenPayload).mockResolvedValue(undefined);

		const first = vi.fn().mockResolvedValue({ license_token: 'encrypted-token' });

		const db = {
			select: vi.fn().mockReturnThis(),
			from: vi.fn().mockReturnThis(),
			first,
		} as unknown as Knex;

		vi.mocked(getDatabase).mockReturnValue(db);
		vi.mocked(getSecretUtils.getSecret).mockReturnValue('test-secret');
		vi.mocked(encryptUtils.decrypt).mockRejectedValue(new Error('decrypt failed'));

		await expect(getLicensePayload()).rejects.toThrow(InvalidLicenseTokenError);

		expect(verify).not.toHaveBeenCalled();
		expect(writeCacheTokenPayload).not.toHaveBeenCalled();
	});

	test('returns undefined when no cache and no license token in database', async () => {
		vi.mocked(readCacheTokenPayload).mockResolvedValue(undefined);

		const first = vi.fn().mockResolvedValue({ license_token: null });

		const db = {
			select: vi.fn().mockReturnThis(),
			from: vi.fn().mockReturnThis(),
			first,
		} as unknown as Knex;

		vi.mocked(getDatabase).mockReturnValue(db);

		const result = await getLicensePayload();

		expect(verify).not.toHaveBeenCalled();
		expect(writeCacheTokenPayload).not.toHaveBeenCalled();
		expect(result).toBeUndefined();
	});

	test('returns undefined when no cache and settings row has no license_token key', async () => {
		vi.mocked(readCacheTokenPayload).mockResolvedValue(undefined);

		const first = vi.fn().mockResolvedValue({});

		const db = {
			select: vi.fn().mockReturnThis(),
			from: vi.fn().mockReturnThis(),
			first,
		} as unknown as Knex;

		vi.mocked(getDatabase).mockReturnValue(db);

		const result = await getLicensePayload();

		expect(verify).not.toHaveBeenCalled();
		expect(result).toBeUndefined();
	});
});

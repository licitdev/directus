import { InvalidLicenseTokenError } from '@directus/errors';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { getDatabase } from '../../database/index.js';
import { readCacheTokenPayload, writeCacheTokenPayload } from '../../utils/cache-token-payload.js';
import { verify } from '../../utils/verify-token.js';
import { getLicensePayload } from './get-license-payload.js';

vi.mock('../../database/index.js');
vi.mock('../../utils/cache-token-payload.js');
vi.mock('../../utils/verify-token.js');

afterEach(() => {
	vi.clearAllMocks();
});

describe('getLicensePayload', () => {
	test('returns cached payload when available', async () => {
		const cachedPayload = { metadata: { entitlements: { featureA: {} } } };

		vi.mocked(readCacheTokenPayload).mockResolvedValue(cachedPayload as any);

		const result = await getLicensePayload();

		expect(result).toEqual(cachedPayload);
		expect(getDatabase).not.toHaveBeenCalled();
		expect(verify).not.toHaveBeenCalled();
		expect(writeCacheTokenPayload).not.toHaveBeenCalled();
	});

	test('loads payload from database, verifies token, caches it and returns it when cache is empty', async () => {
		vi.mocked(readCacheTokenPayload).mockResolvedValue(undefined);

		const first = vi.fn().mockResolvedValue({ license_token: 'jwt-token' });

		const db = {
			select: vi.fn().mockReturnThis(),
			from: vi.fn().mockReturnThis(),
			first,
		};

		vi.mocked(getDatabase).mockReturnValue(db as any);

		const verifiedPayload = { plan: 'pro', metadata: {} };

		vi.mocked(verify).mockResolvedValue(verifiedPayload as any);

		const result = await getLicensePayload();

		expect(getDatabase).toHaveBeenCalled();
		expect(db.select).toHaveBeenCalledWith('license_token');
		expect(db.from).toHaveBeenCalledWith('directus_settings');
		expect(first).toHaveBeenCalled();
		expect(verify).toHaveBeenCalledWith('jwt-token');
		expect(writeCacheTokenPayload).toHaveBeenCalledWith(verifiedPayload);
		expect(result).toEqual(verifiedPayload);
	});

	test('throws InvalidLicenseTokenError when token verification fails', async () => {
		vi.mocked(readCacheTokenPayload).mockResolvedValue(undefined);

		const first = vi.fn().mockResolvedValue({ license_token: 'jwt-token' });

		const db = {
			select: vi.fn().mockReturnThis(),
			from: vi.fn().mockReturnThis(),
			first,
		};

		vi.mocked(getDatabase).mockReturnValue(db as any);
		vi.mocked(verify).mockRejectedValue(new Error('invalid token'));

		await expect(getLicensePayload()).rejects.toThrow(InvalidLicenseTokenError);

		expect(writeCacheTokenPayload).not.toHaveBeenCalled();
	});

	test('returns undefined when no cache and no license token in database', async () => {
		vi.mocked(readCacheTokenPayload).mockResolvedValue(undefined);

		const first = vi.fn().mockResolvedValue({ license_token: null });

		const db = {
			select: vi.fn().mockReturnThis(),
			from: vi.fn().mockReturnThis(),
			first,
		};

		vi.mocked(getDatabase).mockReturnValue(db as any);

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
		};

		vi.mocked(getDatabase).mockReturnValue(db as any);

		const result = await getLicensePayload();

		expect(verify).not.toHaveBeenCalled();
		expect(result).toBeUndefined();
	});
});

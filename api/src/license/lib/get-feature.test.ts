import { InvalidLicenseTokenError } from '@directus/errors';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { getDatabase } from '../../database/index.js';
import { readCacheTokenPayload, writeCacheTokenPayload } from '../../utils/cache-token-payload.js';
import { verify } from '../../utils/verify-token.js';
import { getFeature } from './get-feature.js';

vi.mock('../../database/index.js');
vi.mock('../../utils/cache-token-payload.js');
vi.mock('../../utils/verify-token.js');

afterEach(() => {
	vi.clearAllMocks();
});

describe('getFeature', () => {
	test('throws when path is empty', async () => {
		await expect(getFeature('')).rejects.toThrow('Feature path must not be empty');
	});

	test('returns value from cached payload when available', async () => {
		const cachedPayload = {
			features: {
				myFeature: 'enabled',
			},
		};

		vi.mocked(readCacheTokenPayload).mockResolvedValue(cachedPayload as any);

		const result = await getFeature('features.myFeature');

		expect(result).toBe('enabled');
		expect(getDatabase).not.toHaveBeenCalled();
		expect(verify).not.toHaveBeenCalled();
		expect(writeCacheTokenPayload).not.toHaveBeenCalled();
	});

	test('loads payload from database, verifies token, caches it and returns feature', async () => {
		vi.mocked(readCacheTokenPayload).mockResolvedValue(undefined);

		const first = vi.fn().mockResolvedValue({ license_token: 'jwt-token' });

		const db = {
			select: vi.fn().mockReturnThis(),
			from: vi.fn().mockReturnThis(),
			first,
		};

		vi.mocked(getDatabase).mockReturnValue(db as any);

		const verifiedPayload = {
			features: {
				myFeature: 123,
			},
		};

		vi.mocked(verify).mockResolvedValue(verifiedPayload as any);

		const result = await getFeature('features.myFeature');

		expect(getDatabase).toHaveBeenCalled();
		expect(db.select).toHaveBeenCalledWith('license_token');
		expect(db.from).toHaveBeenCalledWith('directus_settings');
		expect(first).toHaveBeenCalled();
		expect(verify).toHaveBeenCalledWith('jwt-token');
		expect(writeCacheTokenPayload).toHaveBeenCalledWith(verifiedPayload);
		expect(result).toBe(123);
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

		await expect(getFeature('features.myFeature')).rejects.toThrow(InvalidLicenseTokenError);

		expect(writeCacheTokenPayload).not.toHaveBeenCalled();
	});

	test('throws when license payload is not found', async () => {
		vi.mocked(readCacheTokenPayload).mockResolvedValue(null as any);

		const first = vi.fn().mockResolvedValue({ license_token: null });

		const db = {
			select: vi.fn().mockReturnThis(),
			from: vi.fn().mockReturnThis(),
			first,
		};

		vi.mocked(getDatabase).mockReturnValue(db as any);

		await expect(getFeature('features.myFeature')).rejects.toThrow('License payload is not found');

		expect(verify).not.toHaveBeenCalled();
		expect(writeCacheTokenPayload).not.toHaveBeenCalled();
	});

	test('throws when feature path does not exist in payload', async () => {
		const cachedPayload = {
			features: {
				otherFeature: true,
			},
		};

		vi.mocked(readCacheTokenPayload).mockResolvedValue(cachedPayload as any);

		await expect(getFeature('features.missingFeature')).rejects.toThrow('Feature path does not exist: ${path}');
	});
});

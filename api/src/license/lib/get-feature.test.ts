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
	test('throws when feature name is empty', async () => {
		await expect(getFeature('')).rejects.toThrow('Feature name must not be empty');
	});

	test('returns feature data from cached payload when available', async () => {
		const cachedPayload = {
			metadata: {
				entitlements: {
					featureA: { key1: 'value1' },
				},
			},
		};

		vi.mocked(readCacheTokenPayload).mockResolvedValue(cachedPayload as any);

		const result = await getFeature('featureA');

		expect(result).toEqual({ key1: 'value1' });
		expect(getDatabase).not.toHaveBeenCalled();
		expect(verify).not.toHaveBeenCalled();
		expect(writeCacheTokenPayload).not.toHaveBeenCalled();
	});

	test('loads payload from database, verifies token, caches it and returns feature data', async () => {
		vi.mocked(readCacheTokenPayload).mockResolvedValue(undefined);

		const first = vi.fn().mockResolvedValue({ license_token: 'jwt-token' });

		const db = {
			select: vi.fn().mockReturnThis(),
			from: vi.fn().mockReturnThis(),
			first,
		};

		vi.mocked(getDatabase).mockReturnValue(db as any);

		const verifiedPayload = {
			metadata: {
				entitlements: {
					featureA: { key1: 'value1' },
				},
			},
		};

		vi.mocked(verify).mockResolvedValue(verifiedPayload as any);

		const result = await getFeature('featureA');

		expect(getDatabase).toHaveBeenCalled();
		expect(db.select).toHaveBeenCalledWith('license_token');
		expect(db.from).toHaveBeenCalledWith('directus_settings');
		expect(first).toHaveBeenCalled();
		expect(verify).toHaveBeenCalledWith('jwt-token');
		expect(writeCacheTokenPayload).toHaveBeenCalledWith(verifiedPayload);
		expect(result).toEqual({ key1: 'value1' });
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

		await expect(getFeature('featureA')).rejects.toThrow(InvalidLicenseTokenError);

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

		await expect(getFeature('featureA')).rejects.toThrow('License payload is not found');

		expect(verify).not.toHaveBeenCalled();
		expect(writeCacheTokenPayload).not.toHaveBeenCalled();
	});

	test('throws when feature does not exist in entitlements', async () => {
		const cachedPayload = {
			metadata: {
				entitlements: {
					otherFeature: { key1: 'value1' },
				},
			},
		};

		vi.mocked(readCacheTokenPayload).mockResolvedValue(cachedPayload as any);

		await expect(getFeature('missingFeature')).rejects.toThrow(
			'Feature "missingFeature" does not exist in license entitlements',
		);
	});
});

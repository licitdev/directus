import { afterEach, describe, expect, test, vi } from 'vitest';
import * as cache from '../cache.js';
import { readCacheTokenPayload, writeCacheTokenPayload } from './cache-token-payload.js';

vi.mock('../cache.js', () => ({
	getCache: vi.fn(),
	setCacheValue: vi.fn(),
	getCacheValue: vi.fn(),
}));

afterEach(() => {
	vi.clearAllMocks();
});

describe('cache-token-payload utilities', () => {
	test('writeCacheTokenPayload writes payload to system cache with fixed key', async () => {
		const mockSystemCache = {};
		vi.mocked(cache.getCache).mockReturnValue({ systemCache: mockSystemCache } as any);

		const payload = { plan: 'pro', seats: 10 };

		await writeCacheTokenPayload(payload);

		expect(cache.getCache).toHaveBeenCalled();
		expect(cache.setCacheValue).toHaveBeenCalledWith(mockSystemCache, 'licenseTokenPayload', payload);
	});

	test('readCacheTokenPayload reads payload from system cache with fixed key', async () => {
		const mockSystemCache = {};
		const cachedPayload = { plan: 'free' };

		vi.mocked(cache.getCache).mockReturnValue({ systemCache: mockSystemCache } as any);
		vi.mocked(cache.getCacheValue).mockResolvedValue(cachedPayload);

		const result = await readCacheTokenPayload();

		expect(cache.getCache).toHaveBeenCalled();
		expect(cache.getCacheValue).toHaveBeenCalledWith(mockSystemCache, 'licenseTokenPayload');
		expect(result).toEqual(cachedPayload);
	});
});

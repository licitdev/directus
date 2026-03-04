import { afterEach, describe, expect, test, vi } from 'vitest';
import * as cache from '../cache.js';
import { clearCacheTokenPayload, readCacheTokenPayload, writeCacheTokenPayload } from './cache-token-payload.js';

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
		vi.mocked(cache.getCache).mockReturnValue({ systemCache: mockSystemCache } as ReturnType<typeof cache.getCache>);

		const payload = { plan: 'pro', seats: 10 };

		await writeCacheTokenPayload(payload);

		expect(cache.getCache).toHaveBeenCalledOnce();
		expect(cache.setCacheValue).toHaveBeenCalledWith(mockSystemCache, 'licenseTokenPayload', payload);
	});

	test('readCacheTokenPayload reads payload from system cache with fixed key', async () => {
		const mockSystemCache = {};
		const cachedPayload = { plan: 'free' };

		vi.mocked(cache.getCache).mockReturnValue({ systemCache: mockSystemCache } as ReturnType<typeof cache.getCache>);
		vi.mocked(cache.getCacheValue).mockResolvedValue(cachedPayload);

		const result = await readCacheTokenPayload();

		expect(cache.getCache).toHaveBeenCalledOnce();
		expect(cache.getCacheValue).toHaveBeenCalledWith(mockSystemCache, 'licenseTokenPayload');
		expect(result).toEqual(cachedPayload);
	});

	test('clearCacheTokenPayload deletes payload from system cache with fixed key', async () => {
		const deleteMock = vi.fn().mockResolvedValue(undefined);
		const mockSystemCache = { delete: deleteMock };

		vi.mocked(cache.getCache).mockReturnValue({
			systemCache: mockSystemCache,
		} as unknown as ReturnType<typeof cache.getCache>);

		await clearCacheTokenPayload();

		expect(cache.getCache).toHaveBeenCalledOnce();
		expect(deleteMock).toHaveBeenCalledWith('licenseTokenPayload');
	});
});

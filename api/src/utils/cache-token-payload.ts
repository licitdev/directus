import { getCache, getCacheValue, setCacheValue } from '../cache.js';

const CACHE_KEY = 'licenseTokenPayload';

export async function writeCacheTokenPayload(payload: Record<string, unknown>) {
	const { systemCache } = getCache();
	await setCacheValue(systemCache, CACHE_KEY, payload);
}

export async function readCacheTokenPayload(): Promise<Record<string, unknown> | undefined> {
	const { systemCache } = getCache();
	return await getCacheValue(systemCache, CACHE_KEY);
}

export async function clearCacheTokenPayload() {
	const { systemCache } = getCache();
	await systemCache.delete(CACHE_KEY);
}

export async function setTTLCacheTokenPayload(ttl: number) {
	const { systemCache } = getCache();
	const payload = readCacheTokenPayload();

	return setCacheValue(systemCache, CACHE_KEY, payload, ttl);
}

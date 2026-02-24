import { getCache, getCacheValue, setCacheValue } from '../cache.js';

const CACHE_KEY = 'licenseTokenPayload';

export async function writeCacheTokenPayload(payload: Record<string, any>) {
	const { systemCache } = getCache();
	await setCacheValue(systemCache, CACHE_KEY, payload as Record<string, any>);
}

export async function readCacheTokenPayload() {
	const { systemCache } = getCache();
	return await getCacheValue(systemCache, CACHE_KEY);
}

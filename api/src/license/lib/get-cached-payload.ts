import { useEnv } from '@directus/env';
import { importSPKI, jwtVerify } from 'jose';
import type { Knex } from 'knex';
import { getCache, getCacheValue, setCacheValue } from '../../cache.js';
import getDatabase from '../../database/index.js';
import type { GetCachedPayloadOptions } from '../types/get-cached-payload.js';
import type { LicenseTokenPayload } from '../types/index.js';

export type { GetCachedPayloadOptions };

/**
 * License payload cache (getCachedPayload / getFeature).
 *
 * Uses system cache from api/src/cache.ts (Keyv-based, memory or redis).
 * Validity is governed by the JWT payload's exp claim; no separate TTL.
 */

/** Cache key for license data (token + payload). */
const LICENSE_CACHE_KEY = 'license';

/** In-flight load promise so concurrent getCachedPayload callers share one load. */
let inFlightLoadPromise: Promise<LicenseTokenPayload | null> | null = null;

function isPayloadExpired(payload: LicenseTokenPayload): boolean {
	const exp = payload['exp'];
	if (typeof exp !== 'number') return false;

	return exp * 1000 < Date.now();
}

async function writeToCache(token: string, payload: LicenseTokenPayload): Promise<LicenseTokenPayload> {
	const { systemCache } = getCache();
	await setCacheValue(systemCache, LICENSE_CACHE_KEY, { token, payload });
	return payload;
}

async function readFromCache(): Promise<{ token: string; payload: LicenseTokenPayload } | null> {
	const { systemCache } = getCache();

	const data = (await getCacheValue(systemCache, LICENSE_CACHE_KEY)) as
		| { token?: string; payload?: LicenseTokenPayload }
		| undefined;

	if (!data || typeof data.token !== 'string' || !data.payload) return null;

	if (isPayloadExpired(data.payload)) return null;

	return { token: data.token, payload: data.payload };
}

/**
 * Decodes and verifies the license JWT (Ed25519) and returns the payload.
 */
export async function decodeLicenseToken(token: string): Promise<LicenseTokenPayload | null> {
	const env = useEnv();
	const publicKey = env['LICENSE_PUBLIC_KEY'];

	if (typeof publicKey !== 'string' || !publicKey) {
		throw new Error('Missing or invalid LICENSE_PUBLIC_KEY environment variable.');
	}

	const key = await importSPKI(publicKey, 'EdDSA');
	const { payload } = await jwtVerify(token, key, { algorithms: ['EdDSA'] });

	if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
		return null;
	}

	return payload as LicenseTokenPayload;
}

async function safeDecodeLicenseToken(token: string): Promise<LicenseTokenPayload | null> {
	try {
		return await decodeLicenseToken(token);
	} catch {
		return null;
	}
}

/** Clears the license cache and any in-flight lock. Next getCachedPayload() will refetch from DB. */
export async function resetLicenseCache(): Promise<void> {
	inFlightLoadPromise = null;
	const { systemCache } = getCache();
	await systemCache.delete(LICENSE_CACHE_KEY);
}

export async function setLicenseCaches(token: string | null): Promise<void> {
	if (!token) {
		await resetLicenseCache();
		return;
	}

	const payload = await safeDecodeLicenseToken(token);

	if (payload === null) {
		await resetLicenseCache();
		throw new Error(
			'Failed to decode license token. Check LICENSE_PUBLIC_KEY and token validity. Verify cannot succeed without a populated cache.',
		);
	}

	await writeToCache(token, payload);
	inFlightLoadPromise = null;
}

/** Returns the cached raw license token, or null if not cached or expired. */
export async function getCachedLicenseToken(): Promise<string | null> {
	const entry = await readFromCache();
	return entry?.token ?? null;
}

async function fetchLicenseTokenFromSettings(knex?: Knex): Promise<string | null> {
	const db = knex ?? getDatabase();
	const row = await db.select('license_token').from('directus_settings').first();
	const token = row?.license_token;
	return typeof token === 'string' ? token : null;
}

/**
 * Returns the cached payload. If not cached or JWT expired: fetches license_token from directus_settings,
 * decodes it, and updates the cache. Token removal from DB invalidates cache immediately.
 * Does not query DB when cache is valid and JWT not expired.
 *
 * @param knex - Optional Knex instance
 * @param options - Optional token-change detection (runs when cache is within TTL)
 */
export async function getCachedPayload(
	knex?: Knex,
	options?: GetCachedPayloadOptions,
): Promise<LicenseTokenPayload | null> {
	const { detectTokenChange } = options ?? {};
	const entry = await readFromCache();

	if (entry) {
		if (detectTokenChange) {
			const currentToken = await fetchLicenseTokenFromSettings(knex);

			if (currentToken !== entry.token) {
				await resetLicenseCache();

				if (currentToken === null) {
					return null;
				}

				const payload = await safeDecodeLicenseToken(currentToken);

				if (payload === null) {
					return null;
				}

				return writeToCache(currentToken, payload);
			}
		}

		return entry.payload;
	}

	if (inFlightLoadPromise !== null) {
		return inFlightLoadPromise;
	}

	inFlightLoadPromise = (async (): Promise<LicenseTokenPayload | null> => {
		try {
			const token = await fetchLicenseTokenFromSettings(knex);

			if (token === null) {
				await resetLicenseCache();
				return null;
			}

			const payload = await safeDecodeLicenseToken(token);

			if (payload === null) {
				await resetLicenseCache();
				return null;
			}

			return writeToCache(token, payload);
		} finally {
			inFlightLoadPromise = null;
		}
	})();

	return inFlightLoadPromise;
}

import { useEnv } from '@directus/env';
import { importSPKI, jwtVerify } from 'jose';
import type { Knex } from 'knex';
import getDatabase from '../../database/index.js';
import type { LicenseTokenPayload } from '../types/index.js';

/**
 * License payload cache (getCachedPayload / getFeature).
 *
 * **In-memory only:** Cache is stored in process memory.
 */

/** TTL for the license cache in milliseconds. Cache is considered stale after this duration. */
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 1 day

/** Module-level cache for the raw license token. */
let cachedLicenseToken: string | null = null;

/** Module-level cache for the decoded payload. Only set when decode succeeds with a valid payload. */
let cachedPayload: LicenseTokenPayload | null = null;

/** Timestamp when the cache was last set (for TTL invalidation). */
let cacheTimestamp = 0;

/** In-flight load promise so concurrent getCachedPayload callers share one load. */
let inFlightLoadPromise: Promise<LicenseTokenPayload | null> | null = null;

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

/** Clears the in-memory cache and any in-flight lock. Next getCachedPayload() will refetch from DB. */
export function resetLicenseCache(): void {
	cachedLicenseToken = null;
	cachedPayload = null;
	cacheTimestamp = 0;
	inFlightLoadPromise = null;
}

export async function setLicenseCaches(token: string | null): Promise<void> {
	if (!token) {
		resetLicenseCache();
		return;
	}

	const payload = await safeDecodeLicenseToken(token);

	if (payload === null) {
		resetLicenseCache();
		throw new Error(
			'Failed to decode license token. Check LICENSE_PUBLIC_KEY and token validity. Verify cannot succeed without a populated cache.',
		);
	}

	cachedLicenseToken = token;
	cachedPayload = payload;
	cacheTimestamp = Date.now();
	inFlightLoadPromise = null;
}

/** Returns the cached raw license token. */
export function getCachedLicenseToken(): string | null {
	return cachedLicenseToken;
}

async function fetchLicenseTokenFromSettings(knex?: Knex): Promise<string | null> {
	const db = knex ?? getDatabase();
	const row = await db.select('license_token').from('directus_settings').first();
	const token = row?.license_token;
	return typeof token === 'string' ? token : null;
}

export interface GetCachedPayloadOptions {
	/** If true, re-fetch token from DB and reload when token differs from cached (supports token change detection). */
	detectTokenChange?: boolean;
}

/**
 * Returns the cached payload. If not cached or TTL expired: fetches license_token from directus_settings,
 * decodes it, updates cache and cacheTimestamp. Token removal from DB invalidates cache immediately.
 * Does not query DB when cache is valid and within TTL.
 *
 * @param knex - Optional Knex instance
 * @param options - Optional token-change detection (runs when cache is within TTL)
 */
export async function getCachedPayload(
	knex?: Knex,
	options?: GetCachedPayloadOptions,
): Promise<LicenseTokenPayload | null> {
	const { detectTokenChange } = options ?? {};
	const now = Date.now();
	const withinTtl = cachedPayload !== null && now - cacheTimestamp < CACHE_TTL_MS;

	if (withinTtl) {
		if (detectTokenChange) {
			const currentToken = await fetchLicenseTokenFromSettings(knex);

			if (currentToken !== cachedLicenseToken) {
				resetLicenseCache();

				if (currentToken === null) {
					return null;
				}

				const payload = await safeDecodeLicenseToken(currentToken);

				if (payload === null) {
					return null;
				}

				cachedLicenseToken = currentToken;
				cachedPayload = payload;
				cacheTimestamp = Date.now();
				return cachedPayload;
			}
		}

		return cachedPayload;
	}

	if (cachedPayload !== null) {
		resetLicenseCache();
	}

	if (inFlightLoadPromise !== null) {
		return inFlightLoadPromise;
	}

	inFlightLoadPromise = (async (): Promise<LicenseTokenPayload | null> => {
		try {
			const token = await fetchLicenseTokenFromSettings(knex);

			if (token === null) {
				resetLicenseCache();
				return null;
			}

			const payload = await safeDecodeLicenseToken(token);

			if (payload === null) {
				resetLicenseCache();
				return null;
			}

			cachedLicenseToken = token;
			cachedPayload = payload;
			cacheTimestamp = Date.now();
			return cachedPayload;
		} finally {
			inFlightLoadPromise = null;
		}
	})();

	return inFlightLoadPromise;
}

/**
 * Returns the value at the given dot-notation path in the cached payload (e.g. "featureB.maxRoles").
 * Preserves original data types. Throws if the field does not exist.
 */
export async function getFeature(path: string, knex?: Knex, options?: GetCachedPayloadOptions): Promise<unknown> {
	const payload = await getCachedPayload(knex, options);

	if (payload === null || payload === undefined) {
		throw new Error(`License payload not available`);
	}

	const parts = path.split('.');
	let current: unknown = payload;

	for (const key of parts) {
		if (current === null || current === undefined || typeof current !== 'object') {
			throw new Error(`License field does not exist: ${path}`);
		}

		if (!(key in (current as Record<string, unknown>))) {
			throw new Error(`License field does not exist: ${path}`);
		}

		current = (current as Record<string, unknown>)[key];
	}

	return current;
}

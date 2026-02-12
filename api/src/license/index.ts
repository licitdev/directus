import { LicensingService } from './lib/service.js';
import type { GetCachedPayloadOptions } from './lib/use-license.js';
import {
	getCachedPayload as getCachedPayloadFromLib,
	getFeature as getFeatureFromLib,
	resetLicenseCache as resetLicenseCacheFromLib,
} from './lib/use-license.js';
import type { LicenseTokenPayload, VerifyLicenseRequestType } from './types/index.js';
import type { VerifyResponseType } from './types/response.js';

export type { GetCachedPayloadOptions } from './lib/use-license.js';
export type { LicenseTokenPayload } from './types/index.js';

export async function getToken(params: VerifyLicenseRequestType): Promise<VerifyResponseType> {
	const service = new LicensingService();
	return service.verify(params);
}

/** Returns the cached license payload; fetches from directus_settings and decodes when not cached. Cache is in-memory only (not shared across processes). */
export async function getCachedPayload(options?: GetCachedPayloadOptions): Promise<LicenseTokenPayload | null> {
	return getCachedPayloadFromLib(undefined, options);
}

/** Returns the value at the given dot-notation path (e.g. "featureB.maxRoles"). Throws if field does not exist. */
export async function getFeature(path: string, options?: GetCachedPayloadOptions): Promise<unknown> {
	return getFeatureFromLib(path, undefined, options);
}

/** Clears the in-memory license cache. Next getCachedPayload() will refetch from DB. */
export function resetLicenseCache(): void {
	resetLicenseCacheFromLib();
}

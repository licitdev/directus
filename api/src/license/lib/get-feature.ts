import { InvalidLicenseTokenError } from '@directus/errors';
import { get, has } from 'lodash-es';
import { getDatabase } from '../../database/index.js';
import { readCacheTokenPayload, writeCacheTokenPayload } from '../../utils/cache-token-payload.js';
import { verify } from '../../utils/verify-token.js';

export async function getFeature(featureName: string): Promise<Record<string, unknown>> {
	if (!featureName) {
		throw new Error('Feature name must not be empty');
	}

	let payload = await readCacheTokenPayload();

	if (!payload) {
		const database = getDatabase();
		const settings = await database.select('license_token').from('directus_settings').first();

		if (settings?.license_token) {
			try {
				payload = await verify(settings.license_token);
				await writeCacheTokenPayload(payload);
			} catch {
				throw new InvalidLicenseTokenError();
			}
		}
	}

	if (!payload) {
		throw new Error('License payload is not found');
	}

	const featurePath = `metadata.entitlements.${featureName}`;

	if (!has(payload, featurePath)) {
		throw new Error(`Feature "${featureName}" does not exist in license entitlements`);
	}

	return get(payload, featurePath);
}

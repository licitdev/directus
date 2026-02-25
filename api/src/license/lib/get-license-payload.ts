import { InvalidLicenseTokenError } from '@directus/errors';
import { getDatabase } from '../../database/index.js';
import { readCacheTokenPayload, writeCacheTokenPayload } from '../../utils/cache-token-payload.js';
import { verify } from '../../utils/verify-token.js';

export async function getLicensePayload(): Promise<Record<string, unknown>> {
	let payload = await readCacheTokenPayload();

	if (!payload) {
		const database = getDatabase();
		const settings = await database.select('license_token').from('directus_settings').first();

		if (settings?.license_token) {
			try {
				payload = (await verify(settings.license_token)) as Record<string, unknown>;
				await writeCacheTokenPayload(payload as Record<string, any>);
			} catch {
				throw new InvalidLicenseTokenError();
			}
		}
	}

	return payload;
}

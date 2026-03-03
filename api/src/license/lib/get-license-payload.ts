import { InvalidLicenseTokenError } from '@directus/errors';
import { getDatabase } from '../../database/index.js';
import { readCacheTokenPayload, writeCacheTokenPayload } from '../../utils/cache-token-payload.js';
import { decrypt } from '../../utils/encrypt.js';
import { getSecret } from '../../utils/get-secret.js';
import { verify } from '../../utils/verify-token.js';

export async function getLicensePayload(): Promise<Record<string, unknown> | undefined> {
	let payload = await readCacheTokenPayload();

	if (!payload) {
		const database = getDatabase();
		const settings = await database.select('license_token').from('directus_settings').first();

		if (settings?.license_token) {
			try {
				const secret = getSecret();
				const rawToken = await decrypt(settings.license_token, secret);
				payload = await verify(rawToken);
			} catch {
				throw new InvalidLicenseTokenError();
			}

			await writeCacheTokenPayload(payload);
		}
	}

	return payload;
}

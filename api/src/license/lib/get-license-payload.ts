import { useEnv } from '@directus/env';
import { InvalidLicenseTokenError } from '@directus/errors';
import { getDatabase } from '../../database/index.js';
import { readCacheTokenPayload, writeCacheTokenPayload } from '../../utils/cache-token-payload.js';
import { decrypt } from '../../utils/encrypt.js';
import { getSecret } from '../../utils/get-secret.js';
import { verify } from '../../utils/verify-token.js';
import { validate } from './validate.js';

export async function getLicensePayload(): Promise<Record<string, unknown> | undefined> {
	let payload = await readCacheTokenPayload();
	if (payload) return payload;

	const database = getDatabase();
	const settings = await database.select('license_token', 'project_id').from('directus_settings').first();

	if (settings?.license_token) {
		try {
			const secret = getSecret();
			const rawToken = await decrypt(settings.license_token, secret);
			payload = await verify(rawToken);
		} catch {
			throw new InvalidLicenseTokenError();
		}

		await writeCacheTokenPayload(payload);
		return payload;
	}

	const env = useEnv();
	const licenseKeyFromEnv = env['DIRECTUS_LICENSE_KEY'];
	const publicUrl = env['PUBLIC_URL'];

	if (typeof licenseKeyFromEnv === 'string' && licenseKeyFromEnv.trim() && typeof publicUrl === 'string' && publicUrl) {
		try {
			const { token } = await validate({
				license_key: licenseKeyFromEnv.trim(),
				...(settings?.project_id && { project_id: settings.project_id }),
				public_url: publicUrl,
			});

			payload = await verify(token);
			await writeCacheTokenPayload(payload);
			return payload;
		} catch {
		}
	}

	return undefined;
}

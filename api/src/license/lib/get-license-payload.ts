import { useEnv } from '@directus/env';
import { InvalidLicenseTokenError } from '@directus/errors';
import { getDatabase } from '../../database/index.js';
import { useLogger } from '../../logger/index.js';
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
		} catch (error) {
			throw new InvalidLicenseTokenError(undefined, { cause: error });
		}

		await writeCacheTokenPayload(payload);
		return payload;
	}

	const env = useEnv();
	const licenseKeyFromEnv = env['DIRECTUS_LICENSE_KEY'];
	const publicUrl = env['PUBLIC_URL'];

	if (typeof licenseKeyFromEnv === 'string' && licenseKeyFromEnv.trim() && typeof publicUrl === 'string' && publicUrl) {
		let token: string;

		try {
			const validated = await validate({
				licenseKey: licenseKeyFromEnv.trim(),
				...(settings?.project_id && { projectId: settings.project_id }),
				publicUrl,
			});

			token = validated.token;
		} catch (error) {
			const logger = useLogger();
			logger.warn(error, 'License validation failed (DIRECTUS_LICENSE_KEY). Falling back to community mode.');
			return undefined;
		}

		try {
			payload = await verify(token);
			await writeCacheTokenPayload(payload);
			return payload;
		} catch (error) {
			throw new InvalidLicenseTokenError(undefined, { cause: error });
		}
	}

	return undefined;
}

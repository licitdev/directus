import { useEnv } from '@directus/env';
import { InvalidLicenseTokenError } from '@directus/errors';
import { getDatabase } from '../../database/index.js';
import { useLogger } from '../../logger/index.js';
import { readCacheTokenPayload, writeCacheTokenPayload } from '../../utils/cache-token-payload.js';
import { decrypt } from '../../utils/encrypt.js';
import { getSecret } from '../../utils/get-secret.js';
import { verify } from '../../utils/verify-token.js';
import { isLicenseLocked } from './license-status.js';
import { validate } from './validate.js';

export async function getLicensePayload(allowLocked = false): Promise<Record<string, unknown> | undefined> {
	let payload = await readCacheTokenPayload();

	if (!payload) {
		payload = await fetchLicensePayloadFromSource();

		if (payload) {
			await writeCacheTokenPayload(payload);
		}
	}

	if (!payload) return undefined;
	if (!allowLocked && isLicenseLocked(payload)) return undefined;

	return payload;
}

async function fetchLicensePayloadFromSource(): Promise<Record<string, unknown> | undefined> {
	// return {
	// 	project_id: 'c97e19fb-008d-477b-837f-ab99bac360a4',
	// 	public_url: '/',
	// 	metadata: {
	// 		license: {
	// 			status: 'SUSPENDED',
	// 			expiry: null,
	// 			name: 'Linh Test License',
	// 			grace_period: 604800000,
	// 		},
	// 		policy: {
	// 			name: 'Feature Gating Policy',
	// 		},
	// 		entitlements: [
	// 			{
	// 				name: 'custom_permissions',
	// 				enabled: true,
	// 			},
	// 			{
	// 				name: 'sso',
	// 				enabled: true,
	// 			},
	// 			{
	// 				name: 'revisions',
	// 				limit: 10,
	// 			},
	// 			{
	// 				name: 'activity_feed',
	// 				limit: 10,
	// 			},
	// 			{
	// 				name: 'users',
	// 				limit: 10,
	// 			},
	// 			{
	// 				name: 'collections',
	// 				limit: 10,
	// 			},
	// 		],
	// 	},
	// 	iat: 1773918512,
	// 	exp: 1774177712,
	// };

	const database = getDatabase();
	const settings = await database.select('license_token', 'project_id').from('directus_settings').first();

	if (settings?.license_token) {
		try {
			const secret = getSecret();
			const rawToken = await decrypt(settings.license_token, secret);
			return await verify(rawToken);
		} catch (error) {
			throw new InvalidLicenseTokenError(undefined, { cause: error });
		}
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
			return await verify(token);
		} catch (error) {
			throw new InvalidLicenseTokenError(undefined, { cause: error });
		}
	}

	return undefined;
}

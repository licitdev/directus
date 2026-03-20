import { useEnv } from '@directus/env';
import { get } from 'lodash-es';
import { getKey, getLicensePayload, validateAndSave } from '../license/index.js';
import { setTTLCacheTokenPayload } from '../utils/cache-token-payload.js';
import { scheduleSynchronizedJob } from '../utils/schedule.js';

export async function handleLicenseCheckJob() {
	const licenseKey = await getKey();
	if (!licenseKey) return;

	try {
		await validateAndSave(licenseKey);
	} catch {
		const licensePayload = await getLicensePayload();
		const expiry = get(licensePayload, 'license.expiry') as Date | undefined;
		const gracePeriod = get(licensePayload, 'license.metadata.license.grace_period') as number;
		let ttl = 7 * 24 * 60 * 60 * 1000;

		if (gracePeriod && expiry) {
			ttl = expiry.getTime() - Date.now() - gracePeriod * 1000;
		}

		await setTTLCacheTokenPayload(ttl);
	}
}

/**
 * Schedule the license validation checking
 *
 * @returns Whether or not license still valid
 */
export default async function schedule(): Promise<boolean> {
	const env = useEnv();
	const cronTime = env['LICENSE_VALIDATE_SCHEDULE'] ? String(env['LICENSE_VALIDATE_SCHEDULE']) : '0 0 */6 * * *';

	scheduleSynchronizedJob('license-check', cronTime, handleLicenseCheckJob);

	return true;
}

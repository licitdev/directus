import { useEnv } from '@directus/env';
import {
	InvalidLicenseKeyError,
} from '@directus/errors';
import { CronJob } from 'cron';
import { get } from 'lodash-es';
import { getKey, getLicensePayload, validateAndSave } from '../license/index.js';
import { setGracePeriod } from '../license/lib/set-grace-period.js';

export async function handleLicenseCheckJob() {
	const licenseKey = await getKey();
	if (!licenseKey) return;

	try {
		await validateAndSave(licenseKey);
	} catch (e) {
		const licensePayload = await getLicensePayload();
		const gracePeriod = get(licensePayload, 'license.grace_period') as Date | undefined;

		if (e instanceof InvalidLicenseKeyError) {
			await setGracePeriod(gracePeriod);
		}

		throw e;
	}
}

/**
 * Schedule the license validation checking
 *
 * @returns Whether or not license still valid
 */
export default async function schedule(): Promise<boolean> {
	const env = useEnv();
	const cronTime = env['LICENSE_VALIDATE_SCHEDULE'] ? String(env['LICENSE_VALIDATE_SCHEDULE']) : '* * */6 * * *';

	CronJob.from({
		cronTime,
		onTick: handleLicenseCheckJob,
		start: true,
	});

	return true;
}

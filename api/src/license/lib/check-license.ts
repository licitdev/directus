import { useEnv } from '@directus/env';
import { InvalidLicenseConfigError } from '@directus/errors';
import axios from 'axios';
import { handleLicenseApiError } from './handle-api-error.js';

export async function checkLicense({ licenseKey }: { licenseKey: string }) {
	const env = useEnv();
	const url = env['LICENSE_SERVER_URL'];

	if (typeof url !== 'string' || !url) {
		throw new InvalidLicenseConfigError({ reason: 'LICENSE_SERVER_URL is missing or not a string' });
	}

	const baseUrl = url.replace(/\/$/, '');
	const checkLicenseUrl = `${baseUrl}/v1/check`;

	try {
		const response = await axios.post(checkLicenseUrl, { license_key: licenseKey });
		return response.data;
	} catch (error) {
		handleLicenseApiError(error);
	}
}

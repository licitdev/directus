import { useEnv } from '@directus/env';
import axios from 'axios';
import { useLogger } from '../logger/index.js';
import type { VerifyLicenseRequest, VerifyLicenseResponse } from './types.js';

export type { VerifyLicenseRequest, VerifyLicenseResponse } from './types.js';

export async function verify({
	license_key,
	project_id,
	public_url,
}: VerifyLicenseRequest): Promise<VerifyLicenseResponse> {
	const env = useEnv();
	const logger = useLogger();
	const url = env['LICENSING_SERVICE_URL'];

	if (typeof url !== 'string' || !url) {
		throw new Error('Missing or invalid LICENSING_SERVICE_URL environment variable.');
	}

	const baseUrl = url.replace(/\/$/, '');
	const verifyUrl = `${baseUrl}/v1/verify`;

	try {
		const getTokenResponse = await axios.post<VerifyLicenseResponse>(verifyUrl, {
			license_key,
			project_id,
			public_url,
		});

		const { token } = getTokenResponse.data;

		if (typeof token !== 'string' || !token) {
			throw new Error('Missing or invalid license token.');
		}

		return { token };
	} catch (error) {
		logger.error(`Failed to verify license key. Error: ${error}`);
		throw new Error(`Failed to verify license key.`);
	}
}

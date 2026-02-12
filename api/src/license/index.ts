import { useEnv } from '@directus/env';
import axios from 'axios';
import { useLogger } from '../logger/index.js';
import type { ValidateLicenseRequest, ValidateLicenseResponse } from './types.js';

export async function validate({
	license_key,
	project_id,
	public_url,
}: ValidateLicenseRequest): Promise<ValidateLicenseResponse> {
	const env = useEnv();
	const logger = useLogger();
	const url = env['LICENSE_SERVER_URL'];

	if (typeof url !== 'string' || !url) {
		throw new Error('Missing or invalid LICENSE_SERVER_URL environment variable.');
	}

	const baseUrl = url.replace(/\/$/, '');
	const verifyUrl = `${baseUrl}/v1/validate`;

	try {
		const getTokenResponse = await axios.post<ValidateLicenseResponse>(verifyUrl, {
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

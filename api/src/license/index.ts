import { useEnv } from '@directus/env';
import axios from 'axios';
import type { Logger } from 'pino';
import { useLogger } from '../logger/index.js';
import type { VerifyLicenseRequest, VerifyLicenseResponse } from './types.js';

export class LicenseService {
	private baseUrl: string;
	private logger: Logger;

	constructor() {
		this.logger = useLogger();
		const env = useEnv();
		const url = env['LICENSING_SERVICE_URL'];

		if (typeof url !== 'string' || !url) {
			throw new Error('Missing or invalid LICENSING_SERVICE_URL environment variable.');
		}

		this.baseUrl = url.replace(/\/$/, '');
	}

	async verify({ license_key, project_id }: VerifyLicenseRequest): Promise<VerifyLicenseResponse> {
		const verifyUrl = `${this.baseUrl}/v1/verify`;
		try {
			const getTokenResponse = await axios.post<VerifyLicenseResponse>(verifyUrl, { license_key, project_id });
			const { token } = getTokenResponse.data;

			if (typeof token !== 'string' || !token) {
				throw new Error('Missing or invalid license token.');
			}
			return { token };
		} catch (error) {
			this.logger.error(`Failed to verify license key. Error: ${error}`);
			throw new Error(`Failed to verify license key.`);
		}
	}
}

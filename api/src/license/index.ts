import { useEnv } from '@directus/env';
import axios from 'axios';
import type { Knex } from 'knex';
import type { Logger } from 'pino';
import { getDatabase } from '../database/index.js';
import { useLogger } from '../logger/index.js';
import type { GetTokenRequest, GetTokenResponse, VerifyLicenseRequest, VerifyLicenseResponse } from './types.js';

export class LicenseService {
	private knex: Knex;
	private baseUrl: string;
	private logger: Logger;

	constructor(options?: { knex?: Knex }) {
		this.knex = options?.knex ?? getDatabase();
		this.logger = useLogger();
		const env = useEnv();
		const url = env['LICENSING_SERVICE_URL'];

		if (typeof url !== 'string' || !url) {
			throw new Error('LICENSING_SERVICE_URL environment variable is required');
		}

		this.baseUrl = url.replace(/\/$/, '');
	}

	async verify({ license_key }: VerifyLicenseRequest): Promise<VerifyLicenseResponse> {
		const verifyUrl = `${this.baseUrl}/v1/verify`;
		const { project_id } = await this.knex.select('project_id').from('directus_settings').first();

		const getTokenPayload: GetTokenRequest = { license_key, project_id };

		try {
			const getTokenResponse = await axios.post<GetTokenResponse>(verifyUrl, getTokenPayload);
			const { token } = getTokenResponse.data;

			if (typeof token !== 'string' || !token) {
				throw new Error('Missing or invalid license token.');
			}
			return { license_token: token };
		} catch (error) {
			this.logger.error(`Failed to verify license key. Error: ${error}`);
			throw new Error(`Failed to verify license key.`);
		}
	}
}

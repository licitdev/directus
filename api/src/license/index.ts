import { useEnv } from '@directus/env';
import { getDatabase } from '../database/index.js';
import { useLogger } from '../logger/index.js';
import type { Knex } from 'knex';
import type { GetTokenRequest, GetTokenResponse, VerifyLicenseRequest, VerifyLicenseResponse } from './types.js';
import type { Logger } from 'pino';

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

		const getTokenResponse = await fetch(verifyUrl, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(getTokenPayload),
		});

		if (!getTokenResponse.ok) {
			const text = await getTokenResponse.text();
			this.logger.error(`Failed to verify license_key. Error: ${text}`);
			throw new Error(`Failed to verify license_key.`);
		}

		const data: GetTokenResponse = await getTokenResponse.json();
		const { token } = data || {};

		if (typeof token !== 'string') {
			throw new Error('Failed to verify license_key. Invalid license_token received.');
		}

		return { license_token: token };
	}
}

import { useEnv } from '@directus/env';
import type { Knex } from 'knex';
import getDatabase from '../../database/index.js';
import type { VerifyLicenseRequestType, VerifyLicenseResponseType } from '../types/index.js';
import type { VerifyResponseType } from '../types/response.js';
import { setLicenseCaches } from './use-license.js';

export class LicensingService {
	private knex: Knex;
	private baseUrl: string;

	constructor(options?: { knex?: Knex }) {
		this.knex = options?.knex ?? getDatabase();
		const env = useEnv();
		const url = env['LICENSING_SERVICE_URL'];

		if (typeof url !== 'string' || !url) {
			throw new Error('LICENSING_SERVICE_URL environment variable is required');
		}

		this.baseUrl = url.replace(/\/$/, '');
	}

	async verify(params: VerifyLicenseRequestType): Promise<VerifyResponseType> {
		const verifyUrl = `${this.baseUrl}/v1/verify`;
		const settings = await this.knex.select('project_id').from('directus_settings').first();

		const response = await fetch(verifyUrl, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				license_key: params.license_key ?? 'directus-test',
				project_id: settings?.project_id ?? 'directus-test',
			}),
		});

		if (!response.ok) {
			const text = await response.text();
			throw new Error(`License verification failed: ${response.status} ${response.statusText}. ${text}`);
		}

		const data = (await response.json()) as VerifyLicenseResponseType;
		const licenseToken = data?.token;

		if (typeof licenseToken !== 'string') {
			throw new Error('Invalid license response: missing or invalid license_token');
		}

		const updated = await this.knex('directus_settings').update({ license_token: licenseToken });

		if (updated === 0) {
			throw new Error('Failed to persist license_token: no directus_settings row updated');
		}

		await setLicenseCaches(licenseToken);
		return { license_token: licenseToken } as VerifyResponseType;
	}
}

import { useEnv } from '@directus/env';
import axios from 'axios';
import getDatabase from '../../database/index.js';
import type { VerifyLicenseRequest, VerifyLicenseResponse, VerifyOptions } from '../types/verify.js';
import { setLicenseCaches } from './get-cached-payload.js';

/** Response shape from the licensing service /v1/verify endpoint. */
interface VerifyServiceResponse {
	token?: string;
}

/**
 * Verify a license key with the licensing service. Optionally persist the returned token
 * to directus_settings.license_token and always updates the in-memory cache.
 *
 * Uses LICENSING_SERVICE_URL and reads project_id from directus_settings when not provided.
 */
export async function verify(
	params: VerifyLicenseRequest = {},
	options?: VerifyOptions,
): Promise<VerifyLicenseResponse> {
	const env = useEnv();
	const url = env['LICENSING_SERVICE_URL'];

	if (typeof url !== 'string' || !url) {
		throw new Error('LICENSING_SERVICE_URL environment variable is required');
	}

	const knex = options?.knex ?? getDatabase();
	const persist = options?.persist !== false;

	const baseUrl = url.replace(/\/$/, '');
	const verifyUrl = `${baseUrl}/v1/verify`;

	const settings = await knex.select('project_id').from('directus_settings').first();
	const projectId = settings?.project_id ?? 'directus-test';
	const licenseKey = params.license_key ?? 'directus-test';

	const response = await axios.post<VerifyServiceResponse>(verifyUrl, {
		license_key: licenseKey,
		project_id: projectId,
	});

	if (response.status !== 200) {
		const text = typeof response.data === 'string' ? response.data : JSON.stringify(response.data ?? '');

		throw new Error(`License verification failed: ${response.status} ${response.statusText}. ${text}`.trim());
	}

	const data = response.data;
	const token = data?.token;

	if (typeof token !== 'string' || !token) {
		throw new Error('Invalid license response: missing or invalid license_token');
	}

	if (persist) {
		const updated = await knex('directus_settings').update({ license_token: token });

		if (updated === 0) {
			throw new Error('Failed to persist license_token: no directus_settings row updated');
		}
	}

	await setLicenseCaches(token);
	return { license_token: token };
}

import { useEnv } from '@directus/env';
import {
	InvalidLicenseConfigError,
	InvalidLicenseKeyError,
	InvalidLicenseTokenError,
	isDirectusError,
} from '@directus/errors';
import type { AxiosError } from 'axios';
import axios from 'axios';
import type { ValidateLicenseRequest, ValidateLicenseResponse } from './types.js';

export async function validate({
	license_key,
	project_id,
	public_url,
}: ValidateLicenseRequest): Promise<ValidateLicenseResponse> {
	const env = useEnv();
	const url = env['LICENSE_SERVER_URL'];

	if (typeof url !== 'string' || !url) {
		throw new InvalidLicenseConfigError({ reason: 'LICENSE_SERVER_URL is missing or not a string' });
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
			throw new InvalidLicenseTokenError();
		}

		return { token };
	} catch (error) {
		if (isDirectusError(error)) throw error;
		if (!axios.isAxiosError(error)) throw error;

		const axiosError = error as AxiosError<{ error?: string }>;
		const reason = axiosError.response?.data?.error ?? axiosError.message ?? String(axiosError);
		throw new InvalidLicenseKeyError({ reason });
	}
}

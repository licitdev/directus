import { useEnv } from '@directus/env';
import {
	InvalidLicenseConfigError,
	InvalidLicenseKeyError,
	InvalidLicenseTokenError,
	isDirectusError,
	ServiceUnavailableError,
} from '@directus/errors';
import type { AxiosError } from 'axios';
import axios from 'axios';
import type { ValidateLicenseRequest, ValidateLicenseResponse } from '../types/index.js';

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

	let token: string;

	try {
		const getTokenResponse = await axios.post<ValidateLicenseResponse>(verifyUrl, {
			license_key,
			project_id,
			public_url,
		});

		const { token: responseToken } = getTokenResponse.data;

		if (typeof token !== 'string' || !token) {
			throw new Error('Missing or invalid license token.');
		}

		await setLicenseCaches(token);
		return { token };
	} catch (error) {
		if (isDirectusError(error)) throw error;
		if (!axios.isAxiosError(error)) throw error;

		const axiosError = error as AxiosError<{ error?: string }>;
		const reason = axiosError.response?.data?.error ?? axiosError.message ?? String(axiosError);
		const status = axiosError.response?.status;

		if (status === 400) {
			throw new InvalidLicenseKeyError({ reason });
		}

		if (status === 429) {
			throw new ServiceUnavailableError({ service: 'License Server', reason: 'Too many requests' });
		}

		if (!status || status >= 500) {
			throw new ServiceUnavailableError({ service: 'License Server', reason });
		}

		throw new InvalidLicenseKeyError({ reason });
	}

	await setLicenseCaches(token);
	return { token };
}

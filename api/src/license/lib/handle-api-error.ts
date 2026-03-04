import {
	InvalidLicenseKeyError,
	isDirectusError,
	ServiceUnavailableError,
} from '@directus/errors';
import type { AxiosError } from 'axios';
import axios from 'axios';

export function handleLicenseApiError(error: unknown): never {
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

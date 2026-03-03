import { useEnv } from '@directus/env';
import {
	InvalidLicenseConfigError,
	InvalidLicenseKeyError,
	isDirectusError,
	ServiceUnavailableError,
} from '@directus/errors';
import axios, { AxiosError } from 'axios';
import { getProjectId } from '../../utils/get-project-id.js';
import type { DeactivateLicenseRequest, DeactivateLicenseResponse } from '../types/index.js';

export async function deactivate({ licenseKey, projectId }: DeactivateLicenseRequest): Promise<void> {
	const env = useEnv();
	const url = env['LICENSE_SERVER_URL'];

	if (typeof url !== 'string' || !url) {
		throw new InvalidLicenseConfigError({ reason: 'LICENSE_SERVER_URL is missing or not a string' });
	}

	const baseUrl = url.replace(/\/$/, '');
	const deactivateUrl = `${baseUrl}/v1/deactivate`;

	if (!projectId) {
		const storedProjectId = await getProjectId();

		if (typeof storedProjectId !== 'string' || !storedProjectId) {
			throw new InvalidLicenseConfigError({ reason: 'project_id is missing or not a string' });
		}

		projectId = storedProjectId;
	}

	try {
		const response = await axios.post<DeactivateLicenseResponse>(deactivateUrl, {
			license_key: licenseKey,
			project_id: projectId,
		});

		const { success } = response.data;

		if (!success) {
			throw new Error('Failed to deactivate license');
		}
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
}

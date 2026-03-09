import axios from 'axios';
import type { DeactivateLicenseRequest, DeactivateLicenseResponse } from '../types/index.js';
import { handleLicenseApiError } from './handle-api-error.js';
import { getLicenseBaseUrl, resolveProjectId } from './license-context.js';

export async function deactivate({ licenseKey, projectId }: DeactivateLicenseRequest): Promise<void> {
	const baseUrl = getLicenseBaseUrl();
	const deactivateUrl = `${baseUrl}/v1/deactivate`;
	const resolvedProjectId = await resolveProjectId(projectId);

	try {
		const response = await axios.post<DeactivateLicenseResponse>(deactivateUrl, {
			license_key: licenseKey,
			project_id: resolvedProjectId,
		});

		if (!response.data.success) {
			throw new Error('Failed to deactivate license');
		}
	} catch (error) {
		handleLicenseApiError(error);
	}
}

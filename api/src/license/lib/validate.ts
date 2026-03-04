import { InvalidLicenseTokenError } from '@directus/errors';
import axios from 'axios';
import type { ValidateLicenseRequest, ValidateLicenseResponse } from '../types/index.js';
import { handleLicenseApiError } from './handle-api-error.js';
import { getLicenseBaseUrl, resolveProjectId, resolvePublicUrl } from './license-context.js';

export async function validate({
	licenseKey,
	projectId,
	publicUrl,
}: ValidateLicenseRequest): Promise<ValidateLicenseResponse> {
	const baseUrl = getLicenseBaseUrl();
	const verifyUrl = `${baseUrl}/v1/validate`;

	const resolvedProjectId = await resolveProjectId(projectId);
	const resolvedPublicUrl = resolvePublicUrl(publicUrl);

	try {
		const res = await axios.post<ValidateLicenseResponse>(verifyUrl, {
			license_key: licenseKey,
			project_id: resolvedProjectId,
			public_url: resolvedPublicUrl,
		});

		const { token, projectId: newProjectId } = res.data;

		if (typeof token !== 'string' || !token) {
			throw new InvalidLicenseTokenError();
		}

		return { token, projectId: newProjectId };
	} catch (error) {
		handleLicenseApiError(error);
	}
}

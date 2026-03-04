import { useEnv } from '@directus/env';
import { InvalidLicenseConfigError } from '@directus/errors';
import { getProjectId } from '../../utils/get-project-id.js';

export function getLicenseBaseUrl(): string {
	const url = useEnv()['LICENSE_SERVER_URL'];

	if (typeof url !== 'string' || !url) {
		throw new InvalidLicenseConfigError({ reason: 'LICENSE_SERVER_URL is missing or not a string' });
	}

	return url.replace(/\/$/, '');
}

export async function resolveProjectId(projectId?: string): Promise<string> {
	if (projectId) return projectId;

	const stored = await getProjectId();

	if (typeof stored !== 'string' || !stored) {
		throw new InvalidLicenseConfigError({ reason: 'project_id is missing or not a string' });
	}

	return stored;
}

export function resolvePublicUrl(publicUrl?: string): string {
	if (publicUrl) return publicUrl;

	const envPublicUrl = useEnv()['PUBLIC_URL'];

	if (typeof envPublicUrl !== 'string' || !envPublicUrl) {
		throw new InvalidLicenseConfigError({ reason: 'PUBLIC_URL is missing or not a string' });
	}

	return envPublicUrl;
}

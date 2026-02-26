import { getDatabase } from '../../database/index.js';
import { writeCacheTokenPayload } from '../../utils/cache-token-payload.js';
import { verify } from '../../utils/verify-token.js';

export async function saveToken(licenseToken: string, projectId?: string): Promise<void> {
	const payload = await verify(licenseToken);

	const database = getDatabase();

	if (!projectId) {
		const settingsRow = await database.select('project_id').from('directus_settings').first();
		const storedProjectId = settingsRow?.project_id;

		if (typeof storedProjectId !== 'string' || !storedProjectId) {
			throw new Error('project_id is missing or not a string');
		}

		projectId = storedProjectId;
	}

	await database('directus_settings').update({ license_token: licenseToken }).where({ project_id: projectId });
	await writeCacheTokenPayload(payload);
}

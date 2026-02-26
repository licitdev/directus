import { getDatabase } from '../../database/index.js';
import { writeCacheTokenPayload } from '../../utils/cache-token-payload.js';
import { verify } from '../../utils/verify-token.js';

export async function saveToken(license_token: string, project_id?: string): Promise<void> {
	const payload = await verify(license_token);

	const database = getDatabase();

	if (!project_id) {
		const settingsRow = await database.select('project_id').from('directus_settings').first();
		const projectId = settingsRow?.project_id;

		if (typeof projectId !== 'string' || !projectId) {
			throw new Error('project_id is missing or not a string');
		}

		project_id = projectId;
	}

	await database('directus_settings').update({ license_token }).where({ project_id });
	await writeCacheTokenPayload(payload);
}

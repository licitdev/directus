import { getDatabase } from '../../database/index.js';

export async function saveKey(licenseKey: string, projectId?: string): Promise<void> {
	const database = getDatabase();

	if (!projectId) {
		const settingsRow = await database.select('project_id').from('directus_settings').first();
		const storedProjectId = settingsRow?.project_id;

		if (typeof storedProjectId !== 'string' || !storedProjectId) {
			throw new Error('project_id is missing or not a string');
		}

		projectId = storedProjectId;
	}

	await database('directus_settings').update({ license_key: licenseKey }).where({ project_id: projectId });
}

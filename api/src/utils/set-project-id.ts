import { getDatabase } from '../database/index.js';
import { useLogger } from '../logger/index.js';

const logger = useLogger();

export async function setProjectId(projectId: string): Promise<void> {
	const database = getDatabase();
	const row = await database.select('id').from('directus_settings').first();

	if (!row?.id) {
		logger.warn('Failed to set project_id: table directus_settings has no row');
		throw new Error('Failed to set project_id');
	}

	await database('directus_settings').update({ project_id: projectId }).where('id', row.id);
}

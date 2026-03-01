import { getDatabase } from '../../database/index.js';
import { encrypt } from '../../utils/encrypt.js';
import { getProjectId } from '../../utils/get-project-id.js';
import { getSecret } from '../../utils/get-secret.js';

export async function saveKey(licenseKey: string, projectId?: string): Promise<void> {
	const database = getDatabase();

	if (!projectId) {
		const storedProjectId = await getProjectId();

		if (typeof storedProjectId !== 'string' || !storedProjectId) {
			throw new Error('project_id is missing or not a string');
		}

		projectId = storedProjectId;
	}

	const secret = getSecret();
	const encryptedKey = await encrypt(licenseKey, secret);

	await database('directus_settings').update({ license_key: encryptedKey }).where({ project_id: projectId });
}

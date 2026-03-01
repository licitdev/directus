import { getDatabase } from '../../database/index.js';
import { writeCacheTokenPayload } from '../../utils/cache-token-payload.js';
import { encrypt } from '../../utils/encrypt.js';
import { getProjectId } from '../../utils/get-project-id.js';
import { getSecret } from '../../utils/get-secret.js';
import { verify } from '../../utils/verify-token.js';

export async function saveToken(licenseToken: string, projectId?: string): Promise<void> {
	const payload = await verify(licenseToken);

	const database = getDatabase();

	if (!projectId) {
		const storedProjectId = await getProjectId();

		if (typeof storedProjectId !== 'string' || !storedProjectId) {
			throw new Error('project_id is missing or not a string');
		}

		projectId = storedProjectId;
	}

	const secret = getSecret();
	const encryptedToken = await encrypt(licenseToken, secret);

	await database('directus_settings').update({ license_token: encryptedToken }).where({ project_id: projectId });
	await writeCacheTokenPayload(payload);
}

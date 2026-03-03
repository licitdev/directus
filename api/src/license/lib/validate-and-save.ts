import { setProjectId } from '../../utils/set-project-id.js';
import { saveKey } from './save-key.js';
import { saveToken } from './save-token.js';
import { validate } from './validate.js';

export async function validateAndSave(
	licenseKey: string,
	projectId?: string,
	storeKeyInDatabase = false,
): Promise<void> {
	const { token, projectId: newProjectId } = await validate({ licenseKey, ...(projectId && { projectId }) });

	await saveToken(token, projectId);

	if (storeKeyInDatabase) {
		await saveKey(licenseKey, projectId);
	}

	if (newProjectId) {
		await setProjectId(newProjectId);
	}
}

import { useEnv } from '@directus/env';
import { getDatabase } from '../../database/index.js';
import { decrypt } from '../../utils/encrypt.js';
import { getSecret } from '../../utils/get-secret.js';

export async function getKey(): Promise<string | undefined> {
	const env = useEnv();
	const envKey = env['DIRECTUS_LICENSE_KEY'];

	if (typeof envKey === 'string') {
		return envKey;
	}

	const database = getDatabase();
	const settingsRow = await database.select('license_key').from('directus_settings').first();
	const encryptedKey = settingsRow?.license_key;

	if (typeof encryptedKey !== 'string') {
		return undefined;
	}

	const secret = getSecret();
	const key = await decrypt(encryptedKey, secret);

	return key;
}

import { useEnv } from '@directus/env';
import inquirer from 'inquirer';
import { getDatabase } from '../../../database/index.js';
import { validate as validateLicense } from '../../../license/index.js';
import { verify } from '../../../utils/verify-token.js';

export default async function validate(): Promise<void> {
	const { license_key } = await inquirer.prompt([
		{
			type: 'input',
			name: 'license_key',
			message: 'Enter your license key for verification',
		},
	]);

	const database = getDatabase();
	const { project_id } = await database.select('project_id').from('directus_settings').first();

	const env = useEnv();
	const public_url = env['PUBLIC_URL'];

	if (typeof public_url !== 'string' || !public_url) {
		throw new Error('Missing or invalid PUBLIC_URL environment variable.');
	}

	const { token } = await validateLicense({ license_key, project_id, public_url });

	await database('directus_settings').update({ license_token: token }).where({ project_id });

	const payload = await verify(token);

	process.stdout.write('License verified.\n');
	process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
	process.exit(0);
}

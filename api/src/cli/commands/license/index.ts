import { useEnv } from '@directus/env';
import inquirer from 'inquirer';
import { getDatabase } from '../../../database/index.js';
import { verify as verifyLicense } from '../../../license/index.js';

export default async function verify(): Promise<void> {
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

	const { token } = await verifyLicense({ license_key, project_id, public_url });

	await database('directus_settings').update({ license_token: token }).where({ project_id });
	process.stdout.write('License verified.\n');
	process.exit(0);
}

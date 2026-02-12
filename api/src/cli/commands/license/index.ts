import inquirer from 'inquirer';
import { getDatabase } from '../../../database/index.js';
import { LicenseService } from '../../../license/index.js';

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
	const service = new LicenseService();
	const { token } = await service.verify({ license_key, project_id });

	await database('directus_settings').update({ license_token: token }).where({ project_id });
	process.stdout.write('License verified.\n');
	process.exit(0);
}

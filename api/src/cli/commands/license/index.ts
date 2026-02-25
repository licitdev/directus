import inquirer from 'inquirer';
import { getDatabase } from '../../../database/index.js';
import { validate as validateLicense } from '../../../license/index.js';
import { writeCacheTokenPayload } from '../../../utils/cache-token-payload.js';
import { verify } from '../../../utils/verify-token.js';

export default async function validate({ key }: { key?: string }): Promise<void> {
	try {
		if (!key) {
			const { licenseKey } = await inquirer.prompt([
				{
					type: 'input',
					name: 'licenseKey',
					message: 'Enter your license key for verification',
				},
			]);

			key = licenseKey;
		}

		const database = getDatabase();
		const { project_id } = await database.select('project_id').from('directus_settings').first();

		const { token } = await validateLicense({ license_key: key as string, project_id });

		await database('directus_settings').update({ license_token: token }).where({ project_id });

		const payload = await verify(token);
		await writeCacheTokenPayload(payload);

		process.stdout.write('License verified.\n');
		process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
		process.exit(0);
	} catch (error) {
		process.stderr.write(error instanceof Error ? error.message : String(error));
		process.stderr.write('\n');
		process.exit(1);
	}
}

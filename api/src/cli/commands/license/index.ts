import inquirer from 'inquirer';
import { validate as validateLicense } from '../../../license/index.js';
import { saveKey } from '../../../license/lib/save-key.js';
import { saveToken } from '../../../license/lib/save-token.js';
import { setProjectId } from '../../../utils/set-project-id.js';
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

		if (typeof key !== 'string') {
			throw new Error('Invalid license key format');
		}

		const { token, projectId } = await validateLicense({ licenseKey: key });
		const payload = await verify(token);

		await saveToken(token);
		await saveKey(key);

		if (projectId) {
			await setProjectId(projectId);
		}

		process.stdout.write('License verified.\n');
		process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
		process.exit(0);
	} catch (error) {
		process.stderr.write(error instanceof Error ? error.message : String(error));
		process.stderr.write('\n');
		process.exit(1);
	}
}

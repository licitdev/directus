import inquirer from 'inquirer';
import { validate as validateLicense } from '../../../license/index.js';
import { saveToken } from '../../../license/lib/save-token.js';
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

		const { token } = await validateLicense({ license_key: key as string });
		const payload = await verify(token);

		await saveToken(token);

		process.stdout.write('License verified.\n');
		process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
		process.exit(0);
	} catch (error) {
		process.stderr.write(error instanceof Error ? error.message : String(error));
		process.stderr.write('\n');
		process.exit(1);
	}
}

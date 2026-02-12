import inquirer from 'inquirer';
import knex from 'knex';
import { createTracker, MockClient } from 'knex-mock-client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { getDatabase } from '../../../database/index.js';
import * as license from '../../../license/index.js';
import * as tokenUtils from '../../../utils/verify-token.js';
import validate from './index.js';

vi.mock('inquirer');

vi.mock('@directus/env', () => ({
	useEnv: vi.fn().mockReturnValue({ PUBLIC_URL: 'https://project.example.com' }),
}));

vi.mock('../../../database/index.js');
vi.mock('../../../license/index.js');
vi.mock('../../../utils/verify-token.js');

describe('CLI license validate command', () => {
	const db = knex({ client: MockClient });
	const tracker = createTracker(db);

	let exitSpy: any;
	let writeSpy: any;

	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(getDatabase).mockReturnValue(db as any);

		exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
		writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
	});

	afterEach(() => {
		tracker.reset();
		exitSpy.mockRestore();
		writeSpy.mockRestore();
	});

	test('verifies license and updates settings on success', async () => {
		vi.mocked(inquirer.prompt).mockResolvedValue({ license_key: 'my-license-key' } as any);

		tracker.on.select('directus_settings').response([{ project_id: 'project-uuid' }]);
		tracker.on.update('directus_settings').response(1);

		const validateLicenseMock = vi.fn().mockResolvedValue({ token: 'jwt-token' });
		vi.mocked(license.validate).mockImplementation(validateLicenseMock);

		const payload = { plan: 'pro' };
		const verifyTokenMock = vi.fn().mockResolvedValue(payload);
		vi.mocked(tokenUtils.verify).mockImplementation(verifyTokenMock);

		await validate();

		expect(inquirer.prompt).toHaveBeenCalledTimes(1);

		expect(validateLicenseMock).toHaveBeenCalledWith({
			license_key: 'my-license-key',
			project_id: 'project-uuid',
			public_url: 'https://project.example.com',
		});

		expect(verifyTokenMock).toHaveBeenCalledWith('jwt-token');

		expect(tracker.history.update).toHaveLength(1);
		expect(writeSpy).toHaveBeenCalledWith('License verified.\n');
		expect(writeSpy).toHaveBeenCalledWith(`${JSON.stringify(payload, null, 2)}\n`);
		expect(exitSpy).toHaveBeenCalledWith(0);
	});

	test('rejects when validate throws', async () => {
		vi.mocked(inquirer.prompt).mockResolvedValue({ license_key: 'bad-key' } as any);

		tracker.on.select('directus_settings').response([{ project_id: 'project-uuid' }]);

		vi.mocked(license.validate).mockRejectedValue(new Error('bad license'));

		await expect(validate()).rejects.toThrow('bad license');
		expect(writeSpy).not.toHaveBeenCalledWith('License verified.\n');
		expect(exitSpy).not.toHaveBeenCalledWith(0);
	});
});

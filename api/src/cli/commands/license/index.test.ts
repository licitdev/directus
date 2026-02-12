import inquirer from 'inquirer';
import knex from 'knex';
import { createTracker, MockClient } from 'knex-mock-client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { getDatabase } from '../../../database/index.js';
import { LicenseService } from '../../../license/index.js';
import verify from './index.js';

vi.mock('inquirer');
vi.mock('../../../database/index.js');
vi.mock('../../../license/index.js');

describe('CLI license verify command', () => {
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

		const verifyMock = vi.fn().mockResolvedValue({ token: 'jwt-token' });

		vi.mocked(LicenseService).mockImplementation(
			() =>
				({
					verify: verifyMock,
				}) as any,
		);

		await verify();

		expect(inquirer.prompt).toHaveBeenCalledTimes(1);
		expect(verifyMock).toHaveBeenCalledWith({ license_key: 'my-license-key', project_id: 'project-uuid' });
		expect(tracker.history.update).toHaveLength(1);
		expect(writeSpy).toHaveBeenCalledWith('License verified.\n');
		expect(exitSpy).toHaveBeenCalledWith(0);
	});

	test('rejects when verify throws', async () => {
		vi.mocked(inquirer.prompt).mockResolvedValue({ license_key: 'bad-key' } as any);

		tracker.on.select('directus_settings').response([{ project_id: 'project-uuid' }]);

		vi.mocked(LicenseService).mockImplementation(
			() =>
				({
					verify: vi.fn().mockRejectedValue(new Error('bad license')),
				}) as any,
		);

		await expect(verify()).rejects.toThrow('bad license');
		expect(writeSpy).not.toHaveBeenCalledWith('License verified.\n');
		expect(exitSpy).not.toHaveBeenCalledWith(0);
	});
});

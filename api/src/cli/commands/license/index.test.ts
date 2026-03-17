import inquirer from 'inquirer';
import { afterEach, beforeEach, describe, expect, type MockInstance, test, vi } from 'vitest';
import * as license from '../../../license/index.js';
import * as saveKeyModule from '../../../license/lib/save-key.js';
import * as saveTokenModule from '../../../license/lib/save-token.js';
import * as setProjectIdModule from '../../../utils/set-project-id.js';
import * as tokenUtils from '../../../utils/verify-token.js';
import validate from './index.js';

vi.mock('inquirer');
vi.mock('../../../license/index.js');
vi.mock('../../../license/lib/save-key.js');
vi.mock('../../../license/lib/save-token.js');
vi.mock('../../../utils/set-project-id.js');
vi.mock('../../../utils/verify-token.js');

describe('CLI license validate command', () => {
	let exitSpy: MockInstance;
	let stderrSpy: MockInstance;
	let writeSpy: MockInstance;

	beforeEach(() => {
		vi.clearAllMocks();
		exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
		stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
		writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
	});

	afterEach(() => {
		exitSpy.mockRestore();
		stderrSpy.mockRestore();
		writeSpy.mockRestore();
	});

	test('verifies license, saves token, key and project_id on success when key is prompted', async () => {
		vi.mocked(inquirer.prompt).mockResolvedValue({ licenseKey: 'my-license-key' });

		const validateLicenseMock = vi.fn().mockResolvedValue({ token: 'jwt-token', project_id: 'returned-project-id' });

		vi.mocked(license.validate).mockImplementation(validateLicenseMock);

		const payload = { plan: 'pro' };
		vi.mocked(tokenUtils.verify).mockResolvedValue(payload);

		await validate({});

		expect(inquirer.prompt).toHaveBeenCalledTimes(1);
		expect(validateLicenseMock).toHaveBeenCalledWith({ licenseKey: 'my-license-key' });
		expect(tokenUtils.verify).toHaveBeenCalledWith('jwt-token');
		expect(saveTokenModule.saveToken).toHaveBeenCalledWith('jwt-token');
		expect(saveKeyModule.saveKey).toHaveBeenCalledWith('my-license-key');
		expect(setProjectIdModule.setProjectId).toHaveBeenCalledWith('returned-project-id');
		expect(writeSpy).toHaveBeenCalledWith('License verified.\n');
		expect(writeSpy).toHaveBeenCalledWith(`${JSON.stringify(payload, null, 2)}\n`);
		expect(exitSpy).toHaveBeenCalledWith(0);
	});

	test('verifies license, saves token and key on success when key is passed', async () => {
		const validateLicenseMock = vi.fn().mockResolvedValue({ token: 'jwt-token', project_id: 'returned-project-id' });

		vi.mocked(license.validate).mockImplementation(validateLicenseMock);

		const payload = { plan: 'pro' };
		vi.mocked(tokenUtils.verify).mockResolvedValue(payload);

		await validate({ key: 'passed-license-key' });

		expect(inquirer.prompt).not.toHaveBeenCalled();
		expect(validateLicenseMock).toHaveBeenCalledWith({ licenseKey: 'passed-license-key' });
		expect(tokenUtils.verify).toHaveBeenCalledWith('jwt-token');
		expect(saveTokenModule.saveToken).toHaveBeenCalledWith('jwt-token');
		expect(saveKeyModule.saveKey).toHaveBeenCalledWith('passed-license-key');
		expect(setProjectIdModule.setProjectId).toHaveBeenCalledWith('returned-project-id');
		expect(writeSpy).toHaveBeenCalledWith('License verified.\n');
		expect(exitSpy).toHaveBeenCalledWith(0);
	});

	test('does not call setProjectId when validateLicense returns no projectId', async () => {
		const validateLicenseMock = vi.fn().mockResolvedValue({ token: 'jwt-token' });
		vi.mocked(license.validate).mockImplementation(validateLicenseMock);

		const payload = { plan: 'pro' };
		vi.mocked(tokenUtils.verify).mockResolvedValue(payload);

		await validate({ key: 'passed-license-key' });

		expect(saveTokenModule.saveToken).toHaveBeenCalledWith('jwt-token');
		expect(saveKeyModule.saveKey).toHaveBeenCalledWith('passed-license-key');
		expect(setProjectIdModule.setProjectId).not.toHaveBeenCalled();
		expect(exitSpy).toHaveBeenCalledWith(0);
	});

	test('writes error to stderr and exits 1 when validate throws', async () => {
		vi.mocked(inquirer.prompt).mockResolvedValue({ licenseKey: 'bad-key' });
		vi.mocked(license.validate).mockRejectedValue(new Error('bad license'));

		await validate({});

		expect(stderrSpy).toHaveBeenCalledWith('bad license');
		expect(stderrSpy).toHaveBeenCalledWith('\n');
		expect(writeSpy).not.toHaveBeenCalledWith('License verified.\n');
		expect(exitSpy).toHaveBeenCalledWith(1);
	});
});

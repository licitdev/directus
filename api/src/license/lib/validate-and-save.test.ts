import { afterEach, describe, expect, test, vi } from 'vitest';
import * as setProjectIdModule from '../../utils/set-project-id.js';
import * as saveKeyModule from './save-key.js';
import * as saveTokenModule from './save-token.js';
import { validateAndSave } from './validate-and-save.js';
import * as validateModule from './validate.js';

vi.mock('./validate.js');
vi.mock('./save-key.js');
vi.mock('./save-token.js');
vi.mock('../../utils/set-project-id.js');

describe('validateAndSave', () => {
	afterEach(() => {
		vi.clearAllMocks();
	});

	test('calls validate, saveToken, saveKey and setProjectId when validate returns projectId and storeKeyInDatabase is true', async () => {
		vi.mocked(validateModule.validate).mockResolvedValue({
			token: 'jwt-token',
			projectId: 'new-project-id',
		});

		await validateAndSave('my-license-key', undefined, true);

		expect(validateModule.validate).toHaveBeenCalledWith({ licenseKey: 'my-license-key' });
		expect(saveTokenModule.saveToken).toHaveBeenCalledWith('jwt-token', undefined);
		expect(saveKeyModule.saveKey).toHaveBeenCalledWith('my-license-key', undefined);
		expect(setProjectIdModule.setProjectId).toHaveBeenCalledWith('new-project-id');
	});

	test('calls validate, saveToken and setProjectId but not saveKey when storeKeyInDatabase is false', async () => {
		vi.mocked(validateModule.validate).mockResolvedValue({
			token: 'jwt-token',
			projectId: 'new-project-id',
		});

		await validateAndSave('my-license-key');

		expect(validateModule.validate).toHaveBeenCalledWith({ licenseKey: 'my-license-key' });
		expect(saveTokenModule.saveToken).toHaveBeenCalledWith('jwt-token', undefined);
		expect(saveKeyModule.saveKey).not.toHaveBeenCalled();
		expect(setProjectIdModule.setProjectId).toHaveBeenCalledWith('new-project-id');
	});

	test('does not call setProjectId when validate returns falsy projectId', async () => {
		vi.mocked(validateModule.validate).mockResolvedValue({
			token: 'jwt-token',
			projectId: '',
		});

		await validateAndSave('my-license-key', undefined, true);

		expect(saveTokenModule.saveToken).toHaveBeenCalledWith('jwt-token', undefined);
		expect(saveKeyModule.saveKey).toHaveBeenCalledWith('my-license-key', undefined);
		expect(setProjectIdModule.setProjectId).not.toHaveBeenCalled();
	});

	test('passes projectId to validate, saveToken and saveKey when provided', async () => {
		vi.mocked(validateModule.validate).mockResolvedValue({
			token: 'jwt-token',
			projectId: 'returned-project-id',
		});

		await validateAndSave('my-license-key', 'existing-project-id', true);

		expect(validateModule.validate).toHaveBeenCalledWith({
			licenseKey: 'my-license-key',
			projectId: 'existing-project-id',
		});

		expect(saveTokenModule.saveToken).toHaveBeenCalledWith('jwt-token', 'existing-project-id');
		expect(saveKeyModule.saveKey).toHaveBeenCalledWith('my-license-key', 'existing-project-id');
		expect(setProjectIdModule.setProjectId).toHaveBeenCalledWith('returned-project-id');
	});

	test('propagates error when validate throws', async () => {
		vi.mocked(validateModule.validate).mockRejectedValue(new Error('invalid license'));

		await expect(validateAndSave('bad-key', undefined, true)).rejects.toThrow('invalid license');

		expect(saveTokenModule.saveToken).not.toHaveBeenCalled();
		expect(saveKeyModule.saveKey).not.toHaveBeenCalled();
		expect(setProjectIdModule.setProjectId).not.toHaveBeenCalled();
	});
});

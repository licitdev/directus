import { useEnv } from '@directus/env';
import { InvalidLicenseConfigError, InvalidLicenseKeyError, ServiceUnavailableError } from '@directus/errors';
import axios from 'axios';
import { afterEach, expect, test, vi } from 'vitest';
import * as getProjectIdUtils from '../../utils/get-project-id.js';
import { deactivate } from './deactivate.js';

vi.mock('@directus/env', () => ({
	useEnv: vi.fn().mockReturnValue({}),
}));

vi.mock('axios');
vi.mock('../../utils/get-project-id.js');

afterEach(() => {
	vi.clearAllMocks();
});

test('deactivate throws InvalidLicenseConfigError when LICENSE_SERVER_URL is missing', async () => {
	vi.mocked(useEnv).mockReturnValue({});

	await expect(deactivate({ licenseKey: 'key' })).rejects.toThrow(
		'Missing or invalid license configuration. LICENSE_SERVER_URL is missing or not a string.',
	);
});

test('deactivate throws InvalidLicenseConfigError when LICENSE_SERVER_URL is not a string', async () => {
	vi.mocked(useEnv).mockReturnValue({ LICENSE_SERVER_URL: 123 });

	await expect(deactivate({ licenseKey: 'key', projectId: 'id' })).rejects.toThrow(InvalidLicenseConfigError);
});

test('deactivate strips trailing slash from LICENSE_SERVER_URL', async () => {
	vi.mocked(useEnv).mockReturnValue({ LICENSE_SERVER_URL: 'https://license.example.com/' });
	vi.mocked(axios.post).mockResolvedValue({ data: { success: true } });

	await deactivate({
		licenseKey: 'my-license-key',
		projectId: 'project-uuid',
	});

	expect(axios.post).toHaveBeenCalledWith('https://license.example.com/v1/deactivate', {
		license_key: 'my-license-key',
		project_id: 'project-uuid',
	});
});

test('deactivate POSTs to /v1/deactivate with license_key and project_id when both provided', async () => {
	vi.mocked(useEnv).mockReturnValue({ LICENSE_SERVER_URL: 'https://license.example.com' });
	vi.mocked(axios.post).mockResolvedValue({ data: { success: true } });

	await deactivate({
		licenseKey: 'directus-license-key',
		projectId: 'project-uuid',
	});

	expect(getProjectIdUtils.getProjectId).not.toHaveBeenCalled();

	expect(axios.post).toHaveBeenCalledWith('https://license.example.com/v1/deactivate', {
		license_key: 'directus-license-key',
		project_id: 'project-uuid',
	});
});

test('deactivate resolves project_id via getProjectId when not provided', async () => {
	vi.mocked(useEnv).mockReturnValue({ LICENSE_SERVER_URL: 'https://license.example.com' });
	vi.mocked(getProjectIdUtils.getProjectId).mockResolvedValue('resolved-project-id');
	vi.mocked(axios.post).mockResolvedValue({ data: { success: true } });

	await deactivate({ licenseKey: 'directus-license-key' });

	expect(getProjectIdUtils.getProjectId).toHaveBeenCalledOnce();

	expect(axios.post).toHaveBeenCalledWith('https://license.example.com/v1/deactivate', {
		license_key: 'directus-license-key',
		project_id: 'resolved-project-id',
	});
});

test('deactivate throws InvalidLicenseConfigError when project_id cannot be resolved', async () => {
	vi.mocked(useEnv).mockReturnValue({ LICENSE_SERVER_URL: 'https://license.example.com' });
	vi.mocked(getProjectIdUtils.getProjectId).mockResolvedValue(undefined);

	await expect(deactivate({ licenseKey: 'directus-license-key' })).rejects.toThrow(InvalidLicenseConfigError);

	expect(axios.post).not.toHaveBeenCalled();
});

test('deactivate throws when response success is false', async () => {
	vi.mocked(useEnv).mockReturnValue({ LICENSE_SERVER_URL: 'https://license.example.com' });
	vi.mocked(axios.post).mockResolvedValue({ data: { success: false } });

	await expect(deactivate({ licenseKey: 'directus-license-key', projectId: 'project-uuid' })).rejects.toThrow(
		'Failed to deactivate license',
	);
});

test('deactivate throws InvalidLicenseKeyError for 400', async () => {
	vi.mocked(useEnv).mockReturnValue({ LICENSE_SERVER_URL: 'https://license.example.com' });

	const axiosError = Object.assign(new Error('Request failed with status code 400'), {
		isAxiosError: true,
		response: { data: { error: 'Bad Request' }, status: 400 },
	});

	vi.mocked(axios.post).mockRejectedValue(axiosError);
	vi.mocked(axios.isAxiosError).mockReturnValue(true);

	const err = await deactivate({
		licenseKey: 'directus-license-key',
		projectId: 'project-uuid',
	}).catch((e) => e);

	expect(err).toBeInstanceOf(InvalidLicenseKeyError);
	expect(err.message).toBe('Bad Request');
});

test('deactivate throws ServiceUnavailableError for 429', async () => {
	vi.mocked(useEnv).mockReturnValue({ LICENSE_SERVER_URL: 'https://license.example.com' });

	const axiosError = Object.assign(new Error('Request failed with status code 429'), {
		isAxiosError: true,
		response: { data: { error: 'Rate limit exceeded' }, status: 429 },
	});

	vi.mocked(axios.post).mockRejectedValue(axiosError);
	vi.mocked(axios.isAxiosError).mockReturnValue(true);

	const err = await deactivate({
		licenseKey: 'directus-license-key',
		projectId: 'project-uuid',
	}).catch((e) => e);

	expect(err).toBeInstanceOf(ServiceUnavailableError);
	expect(err.message).toBe('Service "License Server" is unavailable. Too many requests.');
});

test('deactivate throws ServiceUnavailableError for 500 or network errors', async () => {
	vi.mocked(useEnv).mockReturnValue({ LICENSE_SERVER_URL: 'https://license.example.com' });

	const axiosError = Object.assign(new Error('Network error'), {
		isAxiosError: true,
		response: undefined,
	});

	vi.mocked(axios.post).mockRejectedValue(axiosError);
	vi.mocked(axios.isAxiosError).mockReturnValue(true);

	const err = await deactivate({
		licenseKey: 'directus-license-key',
		projectId: 'project-uuid',
	}).catch((e) => e);

	expect(err).toBeInstanceOf(ServiceUnavailableError);
	expect(err.message).toBe('Service "License Server" is unavailable. Network error.');
});

test('deactivate throws InvalidLicenseKeyError for other axios errors', async () => {
	vi.mocked(useEnv).mockReturnValue({ LICENSE_SERVER_URL: 'https://license.example.com' });

	const axiosError = Object.assign(new Error('Request failed with status code 403'), {
		isAxiosError: true,
		response: { data: { error: 'Forbidden' }, status: 403 },
	});

	vi.mocked(axios.post).mockRejectedValue(axiosError);
	vi.mocked(axios.isAxiosError).mockReturnValue(true);

	const err = await deactivate({
		licenseKey: 'directus-license-key',
		projectId: 'project-uuid',
	}).catch((e) => e);

	expect(err).toBeInstanceOf(InvalidLicenseKeyError);
	expect(err.message).toBe('Forbidden');
});

test('deactivate rethrows non-Axios errors', async () => {
	vi.mocked(useEnv).mockReturnValue({ LICENSE_SERVER_URL: 'https://license.example.com' });

	vi.mocked(axios.post).mockRejectedValue(new Error('Connection refused'));

	await expect(deactivate({ licenseKey: 'directus-license-key', projectId: 'project-uuid' })).rejects.toThrow(
		'Connection refused',
	);
});

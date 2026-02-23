import { useEnv } from '@directus/env';
import { InvalidLicenseConfigError, InvalidLicenseKeyError, ServiceUnavailableError } from '@directus/errors';
import axios from 'axios';
import { afterEach, expect, test, vi } from 'vitest';
import { validate } from './validate.js';

vi.mock('@directus/env', () => ({
	useEnv: vi.fn().mockReturnValue({}),
}));

vi.mock('axios');

afterEach(() => {
	vi.clearAllMocks();
});

test('validate throws InvalidLicenseConfigError when LICENSE_SERVER_URL is missing', async () => {
	vi.mocked(useEnv).mockReturnValue({});

	await expect(
		validate({ license_key: 'key', project_id: 'id', public_url: 'https://project.example.com' }),
	).rejects.toThrow('Missing or invalid license configuration. LICENSE_SERVER_URL is missing or not a string.');
});

test('validate throws InvalidLicenseConfigError when LICENSE_SERVER_URL is not a string', async () => {
	vi.mocked(useEnv).mockReturnValue({ LICENSE_SERVER_URL: 123 } as any);

	await expect(
		validate({ license_key: 'key', project_id: 'id', public_url: 'https://project.example.com' }),
	).rejects.toThrow(InvalidLicenseConfigError);
});

test('validate strips trailing slash from LICENSE_SERVER_URL', async () => {
	const baseUrl = 'https://license.example.com/';
	vi.mocked(useEnv).mockReturnValue({ LICENSE_SERVER_URL: baseUrl } as any);

	vi.mocked(axios.post).mockResolvedValue({ data: { token: 't' } } as any);

	await validate({
		license_key: 'directus-license-key',
		project_id: 'directus-project-id',
		public_url: 'https://project.example.com',
	});

	expect(axios.post).toHaveBeenCalledWith('https://license.example.com/v1/validate', {
		license_key: 'directus-license-key',
		project_id: 'directus-project-id',
		public_url: 'https://project.example.com',
	});
});

test('validate POSTs to /v1/validate with request body using project_id from directus_settings', async () => {
	vi.mocked(useEnv).mockReturnValue({ LICENSE_SERVER_URL: 'https://license.example.com' } as any);

	vi.mocked(axios.post).mockResolvedValue({ data: { token: 'stored-token' } } as any);

	await validate({
		license_key: 'directus-license-key',
		project_id: 'project-uuid',
		public_url: 'https://project.example.com',
	});

	expect(axios.post).toHaveBeenCalledWith('https://license.example.com/v1/validate', {
		license_key: 'directus-license-key',
		project_id: 'project-uuid',
		public_url: 'https://project.example.com',
	});
});

test('validate returns license_token', async () => {
	vi.mocked(useEnv).mockReturnValue({ LICENSE_SERVER_URL: 'https://license.example.com' } as any);

	vi.mocked(axios.post).mockResolvedValue({ data: { token: 'jwt-token-from-service' } } as any);

	const result = await validate({
		license_key: 'directus-license-key',
		project_id: 'directus-project-id',
		public_url: 'https://project.example.com',
	});

	expect(result).toEqual({ token: 'jwt-token-from-service' });
});

test('validate rethrows non-Axios errors', async () => {
	vi.mocked(useEnv).mockReturnValue({ LICENSE_SERVER_URL: 'https://license.example.com' } as any);

	vi.mocked(axios.post).mockRejectedValue(new Error('Invalid license'));

	await expect(
		validate({
			license_key: 'directus-license-key',
			project_id: 'directus-project-id',
			public_url: 'https://project.example.com',
		}),
	).rejects.toThrow('Invalid license');
});

test('validate throws InvalidLicenseKeyError for 403', async () => {
	vi.mocked(useEnv).mockReturnValue({ LICENSE_SERVER_URL: 'https://license.example.com' } as any);

	const axiosError = Object.assign(new Error('Request failed with status code 403'), {
		isAxiosError: true,
		response: { data: { error: 'Forbidden' }, status: 403 },
	});

	vi.mocked(axios.post).mockRejectedValue(axiosError);
	vi.mocked(axios.isAxiosError).mockReturnValue(true);

	const err = await validate({
		license_key: 'directus-license-key',
		project_id: 'directus-project-id',
		public_url: 'https://project.example.com',
	}).catch((e) => e);

	expect(err).toBeInstanceOf(InvalidLicenseKeyError);
	expect((err as Error).message).toBe('Forbidden');
});

test('validate throws InvalidLicenseKeyError for 400', async () => {
	vi.mocked(useEnv).mockReturnValue({ LICENSE_SERVER_URL: 'https://license.example.com' } as any);

	const axiosError = Object.assign(new Error('Request failed with status code 400'), {
		isAxiosError: true,
		response: { data: { error: 'Bad Request' }, status: 400 },
	});

	vi.mocked(axios.post).mockRejectedValue(axiosError);
	vi.mocked(axios.isAxiosError).mockReturnValue(true);

	const err = await validate({
		license_key: 'directus-license-key',
		project_id: 'directus-project-id',
		public_url: 'https://project.example.com',
	}).catch((e) => e);

	expect(err).toBeInstanceOf(InvalidLicenseKeyError);
	expect((err as Error).message).toBe('Bad Request');
});

test('validate throws ServiceUnavailableError for 429', async () => {
	vi.mocked(useEnv).mockReturnValue({ LICENSE_SERVER_URL: 'https://license.example.com' } as any);

	const axiosError = Object.assign(new Error('Request failed with status code 429'), {
		isAxiosError: true,
		response: { data: { error: 'Rate limit exceeded' }, status: 429 },
	});

	vi.mocked(axios.post).mockRejectedValue(axiosError);
	vi.mocked(axios.isAxiosError).mockReturnValue(true);

	const err = await validate({
		license_key: 'directus-license-key',
		project_id: 'directus-project-id',
		public_url: 'https://project.example.com',
	}).catch((e) => e);

	expect(err).toBeInstanceOf(ServiceUnavailableError);
	expect((err as Error).message).toBe('Service "License Server" is unavailable. Too many requests.');
});

test('validate throws ServiceUnavailableError for 500 or network errors', async () => {
	vi.mocked(useEnv).mockReturnValue({ LICENSE_SERVER_URL: 'https://license.example.com' } as any);

	const axiosError = Object.assign(new Error('Network error'), {
		isAxiosError: true,
		response: undefined,
	});

	vi.mocked(axios.post).mockRejectedValue(axiosError);
	vi.mocked(axios.isAxiosError).mockReturnValue(true);

	const err = await validate({
		license_key: 'directus-license-key',
		project_id: 'directus-project-id',
		public_url: 'https://project.example.com',
	}).catch((e) => e);

	expect(err).toBeInstanceOf(ServiceUnavailableError);
	expect((err as Error).message).toBe('Service "License Server" is unavailable. Network error.');
});

test('validate throws InvalidLicenseTokenError when response has no token', async () => {
	vi.mocked(useEnv).mockReturnValue({ LICENSE_SERVER_URL: 'https://license.example.com' } as any);

	vi.mocked(axios.post).mockResolvedValue({ data: {} } as any);

	await expect(
		validate({
			license_key: 'directus-license-key',
			project_id: 'directus-project-id',
			public_url: 'https://project.example.com',
		}),
	).rejects.toThrow('Missing or invalid license token.');
});

test('validate throws InvalidLicenseTokenError when token is not a string', async () => {
	vi.mocked(useEnv).mockReturnValue({ LICENSE_SERVER_URL: 'https://license.example.com' } as any);

	vi.mocked(axios.post).mockResolvedValue({ data: { token: 123 } } as any);

	await expect(
		validate({
			license_key: 'directus-license-key',
			project_id: 'directus-project-id',
			public_url: 'https://project.example.com',
		}),
	).rejects.toThrow('Missing or invalid license token.');
});

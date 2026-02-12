import { useEnv } from '@directus/env';
import axios from 'axios';
import { afterEach, expect, test, vi } from 'vitest';
import { validate } from './index.js';

vi.mock('@directus/env', () => ({
	useEnv: vi.fn().mockReturnValue({}),
}));

vi.mock('axios');

afterEach(() => {
	vi.clearAllMocks();
});

test('validate throws when LICENSE_SERVER_URL is missing', async () => {
	vi.mocked(useEnv).mockReturnValue({});

	await expect(
		validate({ license_key: 'key', project_id: 'id', public_url: 'https://project.example.com' }),
	).rejects.toThrow('Missing or invalid LICENSE_SERVER_URL environment variable.');
});

test('validate throws when LICENSE_SERVER_URL is not a string', async () => {
	vi.mocked(useEnv).mockReturnValue({ LICENSE_SERVER_URL: 123 } as any);

	await expect(
		validate({ license_key: 'key', project_id: 'id', public_url: 'https://project.example.com' }),
	).rejects.toThrow('Missing or invalid LICENSE_SERVER_URL environment variable.');
});

test('validate strips trailing slash from LICENSING_SERVICE_URL', async () => {
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

test('validate throws when response is not ok', async () => {
	vi.mocked(useEnv).mockReturnValue({ LICENSE_SERVER_URL: 'https://license.example.com' } as any);

	vi.mocked(axios.post).mockRejectedValue(new Error('Invalid license'));

	await expect(
		validate({
			license_key: 'directus-license-key',
			project_id: 'directus-project-id',
			public_url: 'https://project.example.com',
		}),
	).rejects.toThrow('Failed to verify license key.');
});

test('validate throws when response has no token', async () => {
	vi.mocked(useEnv).mockReturnValue({ LICENSE_SERVER_URL: 'https://license.example.com' } as any);

	vi.mocked(axios.post).mockResolvedValue({ data: {} } as any);

	await expect(
		validate({
			license_key: 'directus-license-key',
			project_id: 'directus-project-id',
			public_url: 'https://project.example.com',
		}),
	).rejects.toThrow('Failed to verify license key.');
});

test('validate throws when token is not a string', async () => {
	vi.mocked(useEnv).mockReturnValue({ LICENSE_SERVER_URL: 'https://license.example.com' } as any);

	vi.mocked(axios.post).mockResolvedValue({ data: { token: 123 } } as any);

	await expect(
		validate({
			license_key: 'directus-license-key',
			project_id: 'directus-project-id',
			public_url: 'https://project.example.com',
		}),
	).rejects.toThrow('Failed to verify license key.');
});

import { useEnv } from '@directus/env';
import axios from 'axios';
import { afterEach, expect, test, vi } from 'vitest';
import { verify } from './index.js';

vi.mock('@directus/env', () => ({
	useEnv: vi.fn().mockReturnValue({}),
}));

vi.mock('axios');

afterEach(() => {
	vi.clearAllMocks();
});

test('verify throws when LICENSING_SERVICE_URL is missing', async () => {
	vi.mocked(useEnv).mockReturnValue({});

	await expect(
		verify({ license_key: 'key', project_id: 'id', public_url: 'https://project.example.com' }),
	).rejects.toThrow('Missing or invalid LICENSING_SERVICE_URL environment variable.');
});

test('verify throws when LICENSING_SERVICE_URL is not a string', async () => {
	vi.mocked(useEnv).mockReturnValue({ LICENSING_SERVICE_URL: 123 } as any);

	await expect(
		verify({ license_key: 'key', project_id: 'id', public_url: 'https://project.example.com' }),
	).rejects.toThrow('Missing or invalid LICENSING_SERVICE_URL environment variable.');
});

test('verify strips trailing slash from LICENSING_SERVICE_URL', async () => {
	const baseUrl = 'https://license.example.com/';
	vi.mocked(useEnv).mockReturnValue({ LICENSING_SERVICE_URL: baseUrl } as any);

	vi.mocked(axios.post).mockResolvedValue({ data: { token: 't' } } as any);

	await verify({
		license_key: 'directus-license-key',
		project_id: 'directus-project-id',
		public_url: 'https://project.example.com',
	});

	expect(axios.post).toHaveBeenCalledWith('https://license.example.com/v1/verify', {
		license_key: 'directus-license-key',
		project_id: 'directus-project-id',
		public_url: 'https://project.example.com',
	});
});

test('verify POSTs to /v1/verify with request body using project_id from directus_settings', async () => {
	vi.mocked(useEnv).mockReturnValue({ LICENSING_SERVICE_URL: 'https://license.example.com' } as any);

	vi.mocked(axios.post).mockResolvedValue({ data: { token: 'stored-token' } } as any);

	await verify({
		license_key: 'directus-license-key',
		project_id: 'project-uuid',
		public_url: 'https://project.example.com',
	});

	expect(axios.post).toHaveBeenCalledWith('https://license.example.com/v1/verify', {
		license_key: 'directus-license-key',
		project_id: 'project-uuid',
		public_url: 'https://project.example.com',
	});
});

test('verify returns license_token', async () => {
	vi.mocked(useEnv).mockReturnValue({ LICENSING_SERVICE_URL: 'https://license.example.com' } as any);

	vi.mocked(axios.post).mockResolvedValue({ data: { token: 'jwt-token-from-service' } } as any);

	const result = await verify({
		license_key: 'directus-license-key',
		project_id: 'directus-project-id',
		public_url: 'https://project.example.com',
	});

	expect(result).toEqual({ token: 'jwt-token-from-service' });
});

test('verify throws when response is not ok', async () => {
	vi.mocked(useEnv).mockReturnValue({ LICENSING_SERVICE_URL: 'https://license.example.com' } as any);

	vi.mocked(axios.post).mockRejectedValue(new Error('Invalid license'));

	await expect(
		verify({
			license_key: 'directus-license-key',
			project_id: 'directus-project-id',
			public_url: 'https://project.example.com',
		}),
	).rejects.toThrow('Failed to verify license key.');
});

test('verify throws when response has no token', async () => {
	vi.mocked(useEnv).mockReturnValue({ LICENSING_SERVICE_URL: 'https://license.example.com' } as any);

	vi.mocked(axios.post).mockResolvedValue({ data: {} } as any);

	await expect(
		verify({
			license_key: 'directus-license-key',
			project_id: 'directus-project-id',
			public_url: 'https://project.example.com',
		}),
	).rejects.toThrow('Failed to verify license key.');
});

test('verify throws when token is not a string', async () => {
	vi.mocked(useEnv).mockReturnValue({ LICENSING_SERVICE_URL: 'https://license.example.com' } as any);

	vi.mocked(axios.post).mockResolvedValue({ data: { token: 123 } } as any);

	await expect(
		verify({
			license_key: 'directus-license-key',
			project_id: 'directus-project-id',
			public_url: 'https://project.example.com',
		}),
	).rejects.toThrow('Failed to verify license key.');
});

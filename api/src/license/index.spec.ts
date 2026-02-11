import { useEnv } from '@directus/env';
import axios from 'axios';
import { afterEach, expect, test, vi } from 'vitest';
import { LicenseService } from './index.js';

vi.mock('@directus/env', () => ({
	useEnv: vi.fn().mockReturnValue({}),
}));

vi.mock('axios');

afterEach(() => {
	vi.clearAllMocks();
});

test('constructor throws when LICENSING_SERVICE_URL is missing', () => {
	vi.mocked(useEnv).mockReturnValue({});

	expect(() => new LicenseService()).toThrow('Missing or invalid LICENSING_SERVICE_URL environment variable.');
});

test('constructor throws when LICENSING_SERVICE_URL is not a string', () => {
	vi.mocked(useEnv).mockReturnValue({ LICENSING_SERVICE_URL: 123 } as any);

	expect(() => new LicenseService()).toThrow('Missing or invalid LICENSING_SERVICE_URL environment variable.');
});

test('constructor strips trailing slash from LICENSING_SERVICE_URL', async () => {
	const baseUrl = 'https://license.example.com/';
	vi.mocked(useEnv).mockReturnValue({ LICENSING_SERVICE_URL: baseUrl } as any);

	vi.mocked(axios.post).mockResolvedValue({ data: { token: 't' } } as any);

	const service = new LicenseService();

	await service.verify({ license_key: 'directus-license-key', project_id: 'directus-project-id' });

	expect(axios.post).toHaveBeenCalledWith('https://license.example.com/v1/verify', {
		license_key: 'directus-license-key',
		project_id: 'directus-project-id',
	});
});

test('verify POSTs to /v1/verify with request body using project_id from directus_settings', async () => {
	vi.mocked(useEnv).mockReturnValue({ LICENSING_SERVICE_URL: 'https://license.example.com' } as any);

	vi.mocked(axios.post).mockResolvedValue({ data: { token: 'stored-token' } } as any);

	const service = new LicenseService();

	await service.verify({ license_key: 'directus-license-key', project_id: 'project-uuid' });

	expect(axios.post).toHaveBeenCalledWith('https://license.example.com/v1/verify', {
		license_key: 'directus-license-key',
		project_id: 'project-uuid',
	});
});

test('verify returns license_token', async () => {
	vi.mocked(useEnv).mockReturnValue({ LICENSING_SERVICE_URL: 'https://license.example.com' } as any);

	vi.mocked(axios.post).mockResolvedValue({ data: { token: 'jwt-token-from-service' } } as any);

	const service = new LicenseService();

	const result = await service.verify({ license_key: 'directus-license-key', project_id: 'directus-project-id' });

	expect(result).toEqual({ token: 'jwt-token-from-service' });
});

test('verify throws when response is not ok', async () => {
	vi.mocked(useEnv).mockReturnValue({ LICENSING_SERVICE_URL: 'https://license.example.com' } as any);

	vi.mocked(axios.post).mockRejectedValue(new Error('Invalid license'));

	const service = new LicenseService();

	await expect(
		service.verify({ license_key: 'directus-license-key', project_id: 'directus-project-id' }),
	).rejects.toThrow('Failed to verify license key.');
});

test('verify throws when response has no token', async () => {
	vi.mocked(useEnv).mockReturnValue({ LICENSING_SERVICE_URL: 'https://license.example.com' } as any);

	vi.mocked(axios.post).mockResolvedValue({ data: {} } as any);

	const service = new LicenseService();

	await expect(
		service.verify({ license_key: 'directus-license-key', project_id: 'directus-project-id' }),
	).rejects.toThrow('Failed to verify license key.');
});

test('verify throws when token is not a string', async () => {
	vi.mocked(useEnv).mockReturnValue({ LICENSING_SERVICE_URL: 'https://license.example.com' } as any);

	vi.mocked(axios.post).mockResolvedValue({ data: { token: 123 } } as any);

	const service = new LicenseService();

	await expect(
		service.verify({ license_key: 'directus-license-key', project_id: 'directus-project-id' }),
	).rejects.toThrow('Failed to verify license key.');
});

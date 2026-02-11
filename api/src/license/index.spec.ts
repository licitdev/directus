import { useEnv } from '@directus/env';
import axios from 'axios';
import knex from 'knex';
import { createTracker, MockClient } from 'knex-mock-client';
import { afterEach, expect, test, vi } from 'vitest';
import * as databaseModule from '../database/index.js';
import { LicenseService } from './index.js';

vi.mock('@directus/env', () => ({
	useEnv: vi.fn().mockReturnValue({}),
}));

vi.mock('../database/index.js');
vi.mock('axios');

const db = knex({ client: MockClient });
const tracker = createTracker(db);

vi.mocked(databaseModule.getDatabase).mockReturnValue(db as any);

afterEach(() => {
	tracker.reset();
	vi.clearAllMocks();
});

test('constructor throws when LICENSING_SERVICE_URL is missing', () => {
	vi.mocked(useEnv).mockReturnValue({});

	expect(() => new LicenseService()).toThrow('LICENSING_SERVICE_URL environment variable is required');
});

test('constructor throws when LICENSING_SERVICE_URL is not a string', () => {
	vi.mocked(useEnv).mockReturnValue({ LICENSING_SERVICE_URL: 123 } as any);

	expect(() => new LicenseService()).toThrow('LICENSING_SERVICE_URL environment variable is required');
});

test('constructor strips trailing slash from LICENSING_SERVICE_URL', async () => {
	const baseUrl = 'https://license.example.com/';
	vi.mocked(useEnv).mockReturnValue({ LICENSING_SERVICE_URL: baseUrl } as any);

	tracker.on.select('directus_settings').response([{ project_id: 'proj' }]);

	vi.mocked(axios.post).mockResolvedValue({ data: { token: 't' } } as any);

	const service = new LicenseService();

	await service.verify({ license_key: 'key' });

	expect(axios.post).toHaveBeenCalledWith('https://license.example.com/v1/verify', {
		license_key: 'key',
		project_id: 'proj',
	});
});

test('verify POSTs to /v1/verify with request body using project_id from directus_settings', async () => {
	vi.mocked(useEnv).mockReturnValue({ LICENSING_SERVICE_URL: 'https://license.example.com' } as any);
	tracker.on.select('directus_settings').response([{ project_id: 'project-uuid' }]);

	vi.mocked(axios.post).mockResolvedValue({ data: { token: 'stored-token' } } as any);

	const service = new LicenseService();

	await service.verify({ license_key: 'my-license-key' });

	expect(axios.post).toHaveBeenCalledWith('https://license.example.com/v1/verify', {
		license_key: 'my-license-key',
		project_id: 'project-uuid',
	});
});

test('verify returns license_token', async () => {
	vi.mocked(useEnv).mockReturnValue({ LICENSING_SERVICE_URL: 'https://license.example.com' } as any);
	tracker.on.select('directus_settings').response([{ project_id: 'proj' }]);

	vi.mocked(axios.post).mockResolvedValue({ data: { token: 'jwt-token-from-service' } } as any);

	const service = new LicenseService();

	const result = await service.verify({ license_key: 'key' });

	expect(result).toEqual({ license_token: 'jwt-token-from-service' });
});

test('verify throws when response is not ok', async () => {
	vi.mocked(useEnv).mockReturnValue({ LICENSING_SERVICE_URL: 'https://license.example.com' } as any);
	tracker.on.select('directus_settings').response([{ project_id: 'proj' }]);

	vi.mocked(axios.post).mockRejectedValue(new Error('Invalid license'));

	const service = new LicenseService();

	await expect(service.verify({ license_key: 'bad-key' })).rejects.toThrow('Failed to verify license key.');
});

test('verify throws when response has no token', async () => {
	vi.mocked(useEnv).mockReturnValue({ LICENSING_SERVICE_URL: 'https://license.example.com' } as any);
	tracker.on.select('directus_settings').response([{ project_id: 'proj' }]);

	vi.mocked(axios.post).mockResolvedValue({ data: {} } as any);

	const service = new LicenseService();

	await expect(service.verify({ license_key: 'key' })).rejects.toThrow('Failed to verify license key.');
});

test('verify throws when token is not a string', async () => {
	vi.mocked(useEnv).mockReturnValue({ LICENSING_SERVICE_URL: 'https://license.example.com' } as any);
	tracker.on.select('directus_settings').response([{ project_id: 'proj' }]);

	vi.mocked(axios.post).mockResolvedValue({ data: { token: 123 } } as any);

	const service = new LicenseService();

	await expect(service.verify({ license_key: 'key' })).rejects.toThrow('Failed to verify license key.');
});

test('verify uses provided knex when passed in constructor', async () => {
	const customKnex = knex({ client: MockClient });
	const customTracker = createTracker(customKnex);
	customTracker.on.select('directus_settings').response([{ project_id: 'proj' }]);

	vi.mocked(useEnv).mockReturnValue({ LICENSING_SERVICE_URL: 'https://license.example.com' } as any);

	vi.mocked(axios.post).mockResolvedValue({ data: { token: 't' } } as any);

	const service = new LicenseService({ knex: customKnex });

	await service.verify({ license_key: 'key' });

	expect(customTracker.history.select).toHaveLength(1);
});

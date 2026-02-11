import { useEnv } from '@directus/env';
import knex from 'knex';
import { createTracker, MockClient } from 'knex-mock-client';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import * as databaseModule from '../database/index.js';
import { LicenseService } from './index.js';

vi.mock('@directus/env', () => ({
	useEnv: vi.fn().mockReturnValue({}),
}));

vi.mock('../database/index.js');

const db = knex({ client: MockClient });
const tracker = createTracker(db);

vi.mocked(databaseModule.getDatabase).mockReturnValue(db as any);

beforeEach(() => {
	vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
	tracker.reset();
	vi.clearAllMocks();
	vi.unstubAllGlobals();
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

	vi.mocked(global.fetch).mockResolvedValue({
		ok: true,
		json: vi.fn().mockResolvedValue({ token: 't' }),
	} as unknown as Response);

	const service = new LicenseService();

	await service.verify({ license_key: 'key' });

	expect(global.fetch).toHaveBeenCalledWith('https://license.example.com/v1/verify', expect.any(Object));
});

test('verify POSTs to /v1/verify with request body using project_id from directus_settings', async () => {
	vi.mocked(useEnv).mockReturnValue({ LICENSING_SERVICE_URL: 'https://license.example.com' } as any);
	tracker.on.select('directus_settings').response([{ project_id: 'project-uuid' }]);

	vi.mocked(global.fetch).mockResolvedValue({
		ok: true,
		json: vi.fn().mockResolvedValue({ token: 'stored-token' }),
	} as unknown as Response);

	const service = new LicenseService();

	await service.verify({ license_key: 'my-license-key' });

	expect(global.fetch).toHaveBeenCalledWith(
		'https://license.example.com/v1/verify',
		expect.objectContaining({
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				license_key: 'my-license-key',
				project_id: 'project-uuid',
			}),
		}),
	);
});

test('verify returns license_token', async () => {
	vi.mocked(useEnv).mockReturnValue({ LICENSING_SERVICE_URL: 'https://license.example.com' } as any);
	tracker.on.select('directus_settings').response([{ project_id: 'proj' }]);

	vi.mocked(global.fetch).mockResolvedValue({
		ok: true,
		json: vi.fn().mockResolvedValue({ token: 'jwt-token-from-service' }),
	} as unknown as Response);

	const service = new LicenseService();

	const result = await service.verify({ license_key: 'key' });

	expect(result).toEqual({ license_token: 'jwt-token-from-service' });
});

test('verify throws when response is not ok', async () => {
	vi.mocked(useEnv).mockReturnValue({ LICENSING_SERVICE_URL: 'https://license.example.com' } as any);
	tracker.on.select('directus_settings').response([{ project_id: 'proj' }]);

	vi.mocked(global.fetch).mockResolvedValue({
		ok: false,
		status: 403,
		statusText: 'Forbidden',
		text: vi.fn().mockResolvedValue('Invalid license'),
	} as unknown as Response);

	const service = new LicenseService();

	await expect(service.verify({ license_key: 'bad-key' })).rejects.toThrow('Failed to verify license_key.');
});

test('verify throws when response has no token', async () => {
	vi.mocked(useEnv).mockReturnValue({ LICENSING_SERVICE_URL: 'https://license.example.com' } as any);
	tracker.on.select('directus_settings').response([{ project_id: 'proj' }]);

	vi.mocked(global.fetch).mockResolvedValue({
		ok: true,
		json: vi.fn().mockResolvedValue({}),
	} as unknown as Response);

	const service = new LicenseService();

	await expect(service.verify({ license_key: 'key' })).rejects.toThrow(
		'Failed to verify license_key. Invalid license_token received.',
	);
});

test('verify throws when token is not a string', async () => {
	vi.mocked(useEnv).mockReturnValue({ LICENSING_SERVICE_URL: 'https://license.example.com' } as any);
	tracker.on.select('directus_settings').response([{ project_id: 'proj' }]);

	vi.mocked(global.fetch).mockResolvedValue({
		ok: true,
		json: vi.fn().mockResolvedValue({ token: 123 }),
	} as unknown as Response);

	const service = new LicenseService();

	await expect(service.verify({ license_key: 'key' })).rejects.toThrow(
		'Failed to verify license_key. Invalid license_token received.',
	);
});

test('verify uses provided knex when passed in constructor', async () => {
	const customKnex = knex({ client: MockClient });
	const customTracker = createTracker(customKnex);
	customTracker.on.select('directus_settings').response([{ project_id: 'proj' }]);

	vi.mocked(useEnv).mockReturnValue({ LICENSING_SERVICE_URL: 'https://license.example.com' } as any);

	vi.mocked(global.fetch).mockResolvedValue({
		ok: true,
		json: vi.fn().mockResolvedValue({ token: 't' }),
	} as unknown as Response);

	const service = new LicenseService({ knex: customKnex });

	await service.verify({ license_key: 'key' });

	expect(customTracker.history.select).toHaveLength(1);
});

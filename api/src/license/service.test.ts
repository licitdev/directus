import { useEnv } from '@directus/env';
import knex from 'knex';
import { createTracker, MockClient } from 'knex-mock-client';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import getDatabase from '../database/index.js';
import { LicensingService } from './service.js';

vi.mock('@directus/env', () => ({
	useEnv: vi.fn().mockReturnValue({}),
}));

vi.mock('../database/index.js');

const db = knex({ client: MockClient });
const tracker = createTracker(db);

vi.mocked(getDatabase).mockReturnValue(db);

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

	expect(() => new LicensingService()).toThrow('LICENSING_SERVICE_URL environment variable is required');
});

test('constructor throws when LICENSING_SERVICE_URL is not a string', () => {
	vi.mocked(useEnv).mockReturnValue({ LICENSING_SERVICE_URL: 123 } as any);

	expect(() => new LicensingService()).toThrow('LICENSING_SERVICE_URL environment variable is required');
});

test('constructor strips trailing slash from LICENSING_SERVICE_URL', async () => {
	const baseUrl = 'https://license.example.com/';
	vi.mocked(useEnv).mockReturnValue({ LICENSING_SERVICE_URL: baseUrl } as any);

	tracker.on.select('directus_settings').response([{ project_id: 'proj' }]);
	tracker.on.update('directus_settings').response(1);

	vi.mocked(global.fetch).mockResolvedValue({
		ok: true,
		json: vi.fn().mockResolvedValue({ token: 't' }),
	} as unknown as Response);

	const service = new LicensingService();

	await service.verify({ license_key: 'key' });

	expect(global.fetch).toHaveBeenCalledWith('https://license.example.com/v1/verify', expect.any(Object));
});

test('verify POSTs to /v1/verify with request body using project_id from directus_settings', async () => {
	vi.mocked(useEnv).mockReturnValue({ LICENSING_SERVICE_URL: 'https://license.example.com' } as any);
	tracker.on.select('directus_settings').response([{ project_id: 'project-uuid' }]);
	tracker.on.update('directus_settings').response(1);

	vi.mocked(global.fetch).mockResolvedValue({
		ok: true,
		json: vi.fn().mockResolvedValue({ token: 'stored-token' }),
	} as unknown as Response);

	const service = new LicensingService();

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

test('verify returns license_token and persists to directus_settings', async () => {
	vi.mocked(useEnv).mockReturnValue({ LICENSING_SERVICE_URL: 'https://license.example.com' } as any);
	tracker.on.select('directus_settings').response([{ project_id: 'proj' }]);
	tracker.on.update('directus_settings').response(1);

	vi.mocked(global.fetch).mockResolvedValue({
		ok: true,
		json: vi.fn().mockResolvedValue({ token: 'jwt-token-from-service' }),
	} as unknown as Response);

	const service = new LicensingService();

	const result = await service.verify({ license_key: 'key' });

	expect(result).toEqual({ license_token: 'jwt-token-from-service' });
	const updateCalls = tracker.history.update;
	expect(updateCalls).toHaveLength(1);
	expect(updateCalls[0]?.bindings).toContain('jwt-token-from-service');
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

	const service = new LicensingService();

	await expect(service.verify({ license_key: 'bad-key' })).rejects.toThrow(
		'License verification failed: 403 Forbidden. Invalid license',
	);
});

test('verify throws when response has no token', async () => {
	vi.mocked(useEnv).mockReturnValue({ LICENSING_SERVICE_URL: 'https://license.example.com' } as any);
	tracker.on.select('directus_settings').response([{ project_id: 'proj' }]);

	vi.mocked(global.fetch).mockResolvedValue({
		ok: true,
		json: vi.fn().mockResolvedValue({}),
	} as unknown as Response);

	const service = new LicensingService();

	await expect(service.verify({ license_key: 'key' })).rejects.toThrow(
		'Invalid license response: missing or invalid license_token',
	);
});

test('verify throws when token is not a string', async () => {
	vi.mocked(useEnv).mockReturnValue({ LICENSING_SERVICE_URL: 'https://license.example.com' } as any);
	tracker.on.select('directus_settings').response([{ project_id: 'proj' }]);

	vi.mocked(global.fetch).mockResolvedValue({
		ok: true,
		json: vi.fn().mockResolvedValue({ token: 123 }),
	} as unknown as Response);

	const service = new LicensingService();

	await expect(service.verify({ license_key: 'key' })).rejects.toThrow(
		'Invalid license response: missing or invalid license_token',
	);
});

test('verify throws when persistence updates zero rows', async () => {
	vi.mocked(useEnv).mockReturnValue({ LICENSING_SERVICE_URL: 'https://license.example.com' } as any);
	tracker.on.select('directus_settings').response([{ project_id: 'proj' }]);
	tracker.on.update('directus_settings').response(0);

	vi.mocked(global.fetch).mockResolvedValue({
		ok: true,
		json: vi.fn().mockResolvedValue({ token: 'valid-token' }),
	} as unknown as Response);

	const service = new LicensingService();

	await expect(service.verify({ license_key: 'key' })).rejects.toThrow(
		'Failed to persist license_token: no directus_settings row updated',
	);
});

test('verify uses directus-test as project_id when directus_settings has no project_id', async () => {
	vi.mocked(useEnv).mockReturnValue({ LICENSING_SERVICE_URL: 'https://license.example.com' } as any);
	tracker.on.select('directus_settings').response([{ project_id: null }]);
	tracker.on.update('directus_settings').response(1);

	vi.mocked(global.fetch).mockResolvedValue({
		ok: true,
		json: vi.fn().mockResolvedValue({ token: 't' }),
	} as unknown as Response);

	const service = new LicensingService();
	await service.verify({ license_key: 'key' });

	expect(global.fetch).toHaveBeenCalledWith(
		'https://license.example.com/v1/verify',
		expect.objectContaining({
			body: JSON.stringify({ license_key: 'key', project_id: 'directus-test' }),
		}),
	);
});

test('verify uses directus-test as project_id when directus_settings has no rows', async () => {
	vi.mocked(useEnv).mockReturnValue({ LICENSING_SERVICE_URL: 'https://license.example.com' } as any);
	tracker.on.select('directus_settings').response([]);
	tracker.on.update('directus_settings').response(1);

	vi.mocked(global.fetch).mockResolvedValue({
		ok: true,
		json: vi.fn().mockResolvedValue({ token: 't' }),
	} as unknown as Response);

	const service = new LicensingService();
	await service.verify({ license_key: 'key' });

	expect(global.fetch).toHaveBeenCalledWith(
		'https://license.example.com/v1/verify',
		expect.objectContaining({
			body: JSON.stringify({ license_key: 'key', project_id: 'directus-test' }),
		}),
	);
});

test('verify uses provided knex when passed in constructor', async () => {
	const customKnex = knex({ client: MockClient });
	const customTracker = createTracker(customKnex);
	customTracker.on.select('directus_settings').response([{ project_id: 'proj' }]);
	customTracker.on.update('directus_settings').response(1);

	vi.mocked(useEnv).mockReturnValue({ LICENSING_SERVICE_URL: 'https://license.example.com' } as any);

	vi.mocked(global.fetch).mockResolvedValue({
		ok: true,
		json: vi.fn().mockResolvedValue({ token: 't' }),
	} as unknown as Response);

	const service = new LicensingService({ knex: customKnex });

	await service.verify({ license_key: 'key' });

	expect(customTracker.history.update).toHaveLength(1);
});

import { useEnv } from '@directus/env';
import axios from 'axios';
import knex from 'knex';
import { createTracker, MockClient } from 'knex-mock-client';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import getDatabase from '../../database/index.js';
import { verify } from './verify.js';

vi.mock('@directus/env', () => ({
	useEnv: vi.fn().mockReturnValue({}),
}));

vi.mock('axios', () => ({
	default: { post: vi.fn() },
}));

vi.mock('../../database/index.js');

const db = knex({ client: MockClient });
const tracker = createTracker(db);

vi.mocked(getDatabase).mockReturnValue(db);

beforeEach(() => {
	vi.mocked(useEnv).mockReturnValue({ LICENSING_SERVICE_URL: 'https://license.example.com' } as any);
	vi.mocked(axios.post).mockReset();
	tracker.reset();
});

afterEach(() => {
	vi.clearAllMocks();
});

test('verify throws when LICENSING_SERVICE_URL is missing', async () => {
	vi.mocked(useEnv).mockReturnValue({} as any);

	await expect(verify()).rejects.toThrow('LICENSING_SERVICE_URL environment variable is required');
});

test('verify POSTs to /v1/verify with project_id from directus_settings and persists by default', async () => {
	tracker.on.select('directus_settings').response([{ project_id: 'project-uuid' }]);
	tracker.on.update('directus_settings').response(1);

	vi.mocked(axios.post).mockResolvedValue({
		data: { token: 'stored-token' },
		status: 200,
		statusText: 'OK',
	});

	const result = await verify({ license_key: 'my-license-key' });

	expect(result).toEqual({ license_token: 'stored-token' });

	expect(axios.post).toHaveBeenCalledWith('https://license.example.com/v1/verify', {
		license_key: 'my-license-key',
		project_id: 'project-uuid',
	});

	expect(tracker.history.update).toHaveLength(1);
	expect(tracker.history.update[0]?.bindings).toContain('stored-token');
});

test('verify with persist: false does not update database', async () => {
	tracker.on.select('directus_settings').response([{ project_id: 'proj' }]);

	vi.mocked(axios.post).mockResolvedValue({
		data: { token: 'token' },
		status: 200,
		statusText: 'OK',
	});

	const result = await verify({ license_key: 'key' }, { persist: false });

	expect(result).toEqual({ license_token: 'token' });
	expect(tracker.history.update).toHaveLength(0);
});

test('verify uses directus-test when license_key and project_id omitted', async () => {
	tracker.on.select('directus_settings').response([]);
	tracker.on.update('directus_settings').response(1);

	vi.mocked(axios.post).mockResolvedValue({
		data: { token: 't' },
		status: 200,
		statusText: 'OK',
	});

	await verify({}, { persist: true });

	expect(axios.post).toHaveBeenCalledWith('https://license.example.com/v1/verify', {
		license_key: 'directus-test',
		project_id: 'directus-test',
	});
});

test('verify strips trailing slash from LICENSING_SERVICE_URL', async () => {
	vi.mocked(useEnv).mockReturnValue({ LICENSING_SERVICE_URL: 'https://license.example.com/' } as any);
	tracker.on.select('directus_settings').response([{ project_id: 'proj' }]);
	tracker.on.update('directus_settings').response(1);

	vi.mocked(axios.post).mockResolvedValue({
		data: { token: 't' },
		status: 200,
		statusText: 'OK',
	});

	await verify({ license_key: 'k' });

	expect(axios.post).toHaveBeenCalledWith('https://license.example.com/v1/verify', expect.any(Object));
});

test('verify throws when response is not ok', async () => {
	tracker.on.select('directus_settings').response([{ project_id: 'proj' }]);

	vi.mocked(axios.post).mockResolvedValue({
		data: 'Invalid license',
		status: 403,
		statusText: 'Forbidden',
	});

	await expect(verify({ license_key: 'bad-key' })).rejects.toThrow(
		'License verification failed: 403 Forbidden. Invalid license',
	);
});

test('verify throws when response has no token', async () => {
	tracker.on.select('directus_settings').response([{ project_id: 'proj' }]);

	vi.mocked(axios.post).mockResolvedValue({
		data: {},
		status: 200,
		statusText: 'OK',
	});

	await expect(verify({ license_key: 'key' })).rejects.toThrow(
		'Invalid license response: missing or invalid license_token',
	);
});

test('verify throws when persist is true and no row updated', async () => {
	tracker.on.select('directus_settings').response([{ project_id: 'proj' }]);
	tracker.on.update('directus_settings').response(0);

	vi.mocked(axios.post).mockResolvedValue({
		data: { token: 'valid-token' },
		status: 200,
		statusText: 'OK',
	});

	await expect(verify({ license_key: 'key' })).rejects.toThrow(
		'Failed to persist license_token: no directus_settings row updated',
	);
});

test('verify uses provided knex when passed in options', async () => {
	const customKnex = knex({ client: MockClient });
	const customTracker = createTracker(customKnex);
	customTracker.on.select('directus_settings').response([{ project_id: 'proj' }]);
	customTracker.on.update('directus_settings').response(1);

	vi.mocked(useEnv).mockReturnValue({ LICENSING_SERVICE_URL: 'https://license.example.com' } as any);

	vi.mocked(axios.post).mockResolvedValue({
		data: { token: 't' },
		status: 200,
		statusText: 'OK',
	});

	await verify({ license_key: 'key' }, { knex: customKnex });

	expect(customTracker.history.update).toHaveLength(1);
});

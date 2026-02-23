import { useEnv } from '@directus/env';
import knex from 'knex';
import { createTracker, MockClient } from 'knex-mock-client';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import getDatabase from '../../database/index.js';
import {
	decodeLicenseToken,
	getCachedLicenseToken,
	getCachedPayload,
	resetLicenseCache,
	setLicenseCaches,
} from './get-cached-payload.js';

vi.mock('@directus/env', () => ({
	useEnv: vi.fn().mockReturnValue({ LICENSE_PUBLIC_KEY: 'mock-key' }),
}));

vi.mock('jose', () => ({
	importSPKI: vi.fn().mockResolvedValue({}),
	jwtVerify: vi.fn().mockResolvedValue({ payload: { featureA: true, featureB: { maxRoles: 5 } } }),
}));

vi.mock('../../database/index.js');

const db = knex({ client: MockClient });
const tracker = createTracker(db);

vi.mocked(getDatabase).mockReturnValue(db);

beforeEach(() => {
	vi.mocked(useEnv).mockReturnValue({ LICENSE_PUBLIC_KEY: 'mock-key' } as any);
	resetLicenseCache();
	tracker.reset();
	vi.mocked(getDatabase).mockReturnValue(db);
});

afterEach(() => {
	resetLicenseCache();
	vi.clearAllMocks();
});

test('resetLicenseCache clears cache so getCachedPayload refetches', async () => {
	tracker.on.select('directus_settings').response([{ license_token: 'a-token' }]);

	const payload1 = await getCachedPayload();
	expect(payload1).not.toBeNull();

	resetLicenseCache();
	tracker.on.select('directus_settings').response([{ license_token: 'another-token' }]);

	const payload2 = await getCachedPayload();
	expect(payload2).not.toBeNull();
	expect(tracker.history.select).toHaveLength(2);
});

test('setLicenseCaches with null calls resetLicenseCache', async () => {
	await setLicenseCaches('valid-jwt');
	expect(getCachedLicenseToken()).not.toBeNull();

	await setLicenseCaches(null);
	expect(getCachedLicenseToken()).toBeNull();

	tracker.on.select('directus_settings').response([{ license_token: null }]);
	const payload = await getCachedPayload();
	expect(payload).toBeNull();
});

test('setLicenseCaches with token decodes and populates cache', async () => {
	await setLicenseCaches('valid-jwt');
	expect(getCachedLicenseToken()).toBe('valid-jwt');
	const payload = await getCachedPayload();
	expect(payload).toEqual({ featureA: true, featureB: { maxRoles: 5 } });
});

test('setLicenseCaches throws when decode returns null', async () => {
	const { jwtVerify } = await import('jose');
	vi.mocked(jwtVerify).mockResolvedValueOnce({ payload: null } as any);

	await expect(setLicenseCaches('bad-token')).rejects.toThrow(
		'Failed to decode license token. Check LICENSE_PUBLIC_KEY and token validity.',
	);

	expect(getCachedLicenseToken()).toBeNull();
});

test('getCachedLicenseToken returns cached token after setLicenseCaches', async () => {
	expect(getCachedLicenseToken()).toBeNull();
	await setLicenseCaches('cached-token');
	expect(getCachedLicenseToken()).toBe('cached-token');
});

test('getCachedPayload returns null when no token in DB', async () => {
	tracker.on.select('directus_settings').response([{ license_token: null }]);

	const payload = await getCachedPayload();
	expect(payload).toBeNull();
});

test('getCachedPayload fetches from DB and decodes when cache empty', async () => {
	tracker.on.select('directus_settings').response([{ license_token: 'db-token' }]);

	const payload = await getCachedPayload();
	expect(payload).toEqual({ featureA: true, featureB: { maxRoles: 5 } });
	expect(getCachedLicenseToken()).toBe('db-token');
});

test('getCachedPayload returns cached payload without DB query when within TTL', async () => {
	tracker.on.select('directus_settings').response([{ license_token: 'token' }]);
	await getCachedPayload();
	const selectCount = tracker.history.select.length;

	const payload = await getCachedPayload();
	expect(payload).toEqual({ featureA: true, featureB: { maxRoles: 5 } });
	expect(tracker.history.select).toHaveLength(selectCount);
});

test('getCachedPayload with detectTokenChange returns null when token removed from DB', async () => {
	await setLicenseCaches('token');
	tracker.reset();
	tracker.on.select('directus_settings').response([{ license_token: null }]);

	const payload = await getCachedPayload(undefined, { detectTokenChange: true });
	expect(payload).toBeNull();
});

test('getCachedPayload with detectTokenChange reloads when token changed in DB', async () => {
	await setLicenseCaches('old-token');
	tracker.reset();
	const { jwtVerify } = await import('jose');

	vi.mocked(jwtVerify).mockResolvedValueOnce({
		payload: { featureA: false, featureB: { maxRoles: 10 } },
	} as any);

	tracker.on.select('directus_settings').response([{ license_token: 'new-token' }]);

	const payload = await getCachedPayload(undefined, { detectTokenChange: true });
	expect(payload).toEqual({ featureA: false, featureB: { maxRoles: 10 } });
	expect(getCachedLicenseToken()).toBe('new-token');
});

test('getCachedPayload resets cache and returns null when decode fails after fetch', async () => {
	resetLicenseCache();
	tracker.on.select('directus_settings').response([{ license_token: 'token' }]);
	const { jwtVerify } = await import('jose');
	vi.mocked(jwtVerify).mockResolvedValueOnce({ payload: null } as any);

	const payload = await getCachedPayload();
	expect(payload).toBeNull();
	expect(getCachedLicenseToken()).toBeNull();
});

test('decodeLicenseToken throws when LICENSE_PUBLIC_KEY missing', async () => {
	const { useEnv } = await import('@directus/env');
	vi.mocked(useEnv).mockReturnValue({} as any);

	await expect(decodeLicenseToken('token')).rejects.toThrow(
		'Missing or invalid LICENSE_PUBLIC_KEY environment variable.',
	);
});

test('concurrent getCachedPayload callers share one in-flight load', async () => {
	resetLicenseCache();
	vi.mocked(getDatabase).mockReturnValue(db);
	tracker.on.select('directus_settings').response([{ license_token: 'shared-token' }]);

	const [payload1, payload2] = await Promise.all([getCachedPayload(), getCachedPayload()]);

	expect(payload1).toEqual(payload2);
	expect(payload1).not.toBeNull();
	expect(tracker.history.select).toHaveLength(1);
});

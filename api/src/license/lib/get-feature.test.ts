import Keyv from 'keyv';
import knex from 'knex';
import { createTracker, MockClient } from 'knex-mock-client';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import getDatabase from '../../database/index.js';
import { resetLicenseCache, setLicenseCaches } from './get-cached-payload.js';
import { getFeature } from './get-feature.js';

vi.mock('@directus/env', () => ({
	useEnv: vi.fn().mockReturnValue({ LICENSE_PUBLIC_KEY: 'mock-key' }),
}));

vi.mock('jose', () => ({
	importSPKI: vi.fn().mockResolvedValue({}),
	jwtVerify: vi.fn().mockResolvedValue({ payload: { featureA: true, featureB: { maxRoles: 5 } } }),
}));

vi.mock('../../database/index.js');

const systemCache = new Keyv();

vi.mock('../../cache.js', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../../cache.js')>();
	return {
		...actual,
		getCache: vi.fn(() => ({
			cache: null,
			systemCache,
			deploymentCache: new Keyv(),
			localSchemaCache: new Keyv(),
			lockCache: new Keyv(),
		})),
	};
});

const db = knex({ client: MockClient });
const tracker = createTracker(db);

vi.mocked(getDatabase).mockReturnValue(db);

beforeEach(async () => {
	await resetLicenseCache();
	tracker.reset();
	vi.mocked(getDatabase).mockReturnValue(db);
});

afterEach(() => {
	vi.clearAllMocks();
});

test('getFeature returns value at dot-notation path', async () => {
	const { jwtVerify } = await import('jose');

	vi.mocked(jwtVerify).mockResolvedValue({
		payload: { featureA: true, featureB: { maxRoles: 5 } },
	} as any);

	await setLicenseCaches('token');
	const value = await getFeature('featureB.maxRoles');
	expect(value).toBe(5);
});

test('getFeature throws when payload not available', async () => {
	tracker.on.select('directus_settings').response([{ license_token: null }]);

	await expect(getFeature('featureA')).rejects.toThrow('License payload not available');
});

test('getFeature throws when field does not exist', async () => {
	await setLicenseCaches('token');

	await expect(getFeature('missing')).rejects.toThrow('License field does not exist: missing');
	await expect(getFeature('featureB.missing')).rejects.toThrow('License field does not exist: featureB.missing');
});

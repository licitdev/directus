import { useEnv } from '@directus/env';
import { InvalidLicenseTokenError } from '@directus/errors';
import type { Knex } from 'knex';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { getDatabase } from '../../database/index.js';
import { readCacheTokenPayload, writeCacheTokenPayload } from '../../utils/cache-token-payload.js';
import * as encryptUtils from '../../utils/encrypt.js';
import * as getSecretUtils from '../../utils/get-secret.js';
import { verify } from '../../utils/verify-token.js';
import { getLicensePayload } from './get-license-payload.js';
import { validate } from './validate.js';

vi.mock('../../database/index.js');

vi.mock('../../logger/index.js', () => ({
	useLogger: vi.fn().mockReturnValue({ warn: vi.fn() }),
}));

vi.mock('../../utils/cache-token-payload.js');
vi.mock('../../utils/encrypt.js');
vi.mock('../../utils/get-secret.js');
vi.mock('../../utils/verify-token.js');
vi.mock('@directus/env', () => ({ useEnv: vi.fn().mockReturnValue({}) }));
vi.mock('./validate.js');

afterEach(() => {
	vi.clearAllMocks();
});

function mockDb(row: Record<string, unknown>) {
	const first = vi.fn().mockResolvedValue(row);

	const db = {
		select: vi.fn().mockReturnThis(),
		from: vi.fn().mockReturnThis(),
		first,
	} as unknown as Knex;

	vi.mocked(getDatabase).mockReturnValue(db);
	return { db, first };
}

describe('getLicensePayload', () => {
	test('returns cached payload when available', async () => {
		const cachedPayload = { metadata: { entitlements: { featureA: {} } } };

		vi.mocked(readCacheTokenPayload).mockResolvedValue(cachedPayload);

		const result = await getLicensePayload();

		expect(result).toEqual(cachedPayload);
		expect(getDatabase).not.toHaveBeenCalled();
		expect(verify).not.toHaveBeenCalled();
		expect(writeCacheTokenPayload).not.toHaveBeenCalled();
	});

	test('decrypts token from database, verifies it, caches payload and returns it when cache is empty', async () => {
		vi.mocked(readCacheTokenPayload).mockResolvedValue(undefined);

		vi.mocked(getSecretUtils.getSecret).mockReturnValue('test-secret' as any);
		vi.mocked(encryptUtils.decrypt).mockResolvedValue('jwt-token');

		const { db, first } = mockDb({ license_token: 'encrypted-token', project_id: 'proj-1' });

		const verifiedPayload = { plan: 'pro', metadata: {} };

		vi.mocked(verify).mockResolvedValue(verifiedPayload);

		const result = await getLicensePayload();

		expect(getDatabase).toHaveBeenCalled();
		expect(db.select).toHaveBeenCalledWith('license_token', 'project_id');
		expect(db.from).toHaveBeenCalledWith('directus_settings');
		expect(first).toHaveBeenCalled();
		expect(getSecretUtils.getSecret).toHaveBeenCalled();
		expect(encryptUtils.decrypt).toHaveBeenCalledWith('encrypted-token', 'test-secret');
		expect(verify).toHaveBeenCalledWith('jwt-token');
		expect(writeCacheTokenPayload).toHaveBeenCalledWith(verifiedPayload);
		expect(result).toEqual(verifiedPayload);
	});

	test('throws InvalidLicenseTokenError when token verification fails', async () => {
		vi.mocked(readCacheTokenPayload).mockResolvedValue(undefined);

		mockDb({ license_token: 'jwt-token', project_id: null });

		vi.mocked(verify).mockRejectedValue(new Error('invalid token'));

		await expect(getLicensePayload()).rejects.toThrow(InvalidLicenseTokenError);

		expect(writeCacheTokenPayload).not.toHaveBeenCalled();
	});

	test('throws InvalidLicenseTokenError when decrypt fails', async () => {
		vi.mocked(readCacheTokenPayload).mockResolvedValue(undefined);
		vi.mocked(useEnv).mockReturnValue({ PUBLIC_URL: '', DIRECTUS_LICENSE_KEY: undefined } as any);

		mockDb({ license_token: null, project_id: null });

		const result = await getLicensePayload();

		expect(verify).not.toHaveBeenCalled();
		expect(writeCacheTokenPayload).not.toHaveBeenCalled();
		expect(result).toBeUndefined();
	});

	test('returns undefined when no cache and settings row has no license_token key', async () => {
		vi.mocked(readCacheTokenPayload).mockResolvedValue(undefined);
		vi.mocked(useEnv).mockReturnValue({ PUBLIC_URL: '', DIRECTUS_LICENSE_KEY: undefined } as any);

		mockDb({});

		const result = await getLicensePayload();

		expect(verify).not.toHaveBeenCalled();
		expect(result).toBeUndefined();
	});

	describe('env var fallback (DIRECTUS_LICENSE_KEY)', () => {
		test('validates env key, caches and returns payload when no DB token', async () => {
			vi.mocked(readCacheTokenPayload).mockResolvedValue(undefined);

			vi.mocked(useEnv).mockReturnValue({
				DIRECTUS_LICENSE_KEY: 'ENV-KEY-1234',
				PUBLIC_URL: 'http://localhost:8055',
			} as any);

			mockDb({ license_token: null, project_id: 'proj-1' });

			vi.mocked(validate).mockResolvedValue({ token: 'env-jwt-token' } as any);

			const verifiedPayload = { metadata: { license: { status: 'ACTIVE' } } };

			vi.mocked(verify).mockResolvedValue(verifiedPayload);

			const result = await getLicensePayload();

			expect(validate).toHaveBeenCalledWith({
				licenseKey: 'ENV-KEY-1234',
				projectId: 'proj-1',
				publicUrl: 'http://localhost:8055',
			});

			expect(verify).toHaveBeenCalledWith('env-jwt-token');
			expect(writeCacheTokenPayload).toHaveBeenCalledWith(verifiedPayload);
			expect(result).toEqual(verifiedPayload);
		});

		test('returns undefined (does not throw) when env key validation fails', async () => {
			vi.mocked(readCacheTokenPayload).mockResolvedValue(undefined);

			vi.mocked(useEnv).mockReturnValue({
				DIRECTUS_LICENSE_KEY: 'INVALID-KEY',
				PUBLIC_URL: 'http://localhost:8055',
			} as any);

			mockDb({ license_token: null, project_id: null });

			vi.mocked(validate).mockRejectedValue(new Error('License not found'));

			const result = await getLicensePayload();

			expect(result).toBeUndefined();
			expect(writeCacheTokenPayload).not.toHaveBeenCalled();
		});

		test('skips env fallback when PUBLIC_URL is not set', async () => {
			vi.mocked(readCacheTokenPayload).mockResolvedValue(undefined);

			vi.mocked(useEnv).mockReturnValue({
				DIRECTUS_LICENSE_KEY: 'ENV-KEY-1234',
				PUBLIC_URL: '',
			} as any);

			mockDb({ license_token: null, project_id: null });

			const result = await getLicensePayload();

			expect(validate).not.toHaveBeenCalled();
			expect(result).toBeUndefined();
		});
	});
});

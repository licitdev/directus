import { useEnv } from '@directus/env';
import { importSPKI, jwtVerify } from 'jose';
import { afterEach, expect, test, vi } from 'vitest';
import { verify } from './verify-token.js';

vi.mock('@directus/env', () => ({
	useEnv: vi.fn().mockReturnValue({}),
}));

vi.mock('jose', () => ({
	importSPKI: vi.fn(),
	jwtVerify: vi.fn(),
}));

afterEach(() => {
	vi.clearAllMocks();
});

test('verify throws when LICENSE_PUBLIC_KEY is missing', async () => {
	vi.mocked(useEnv).mockReturnValue({});

	await expect(verify('jwt-token')).rejects.toThrow('Missing or invalid LICENSE_PUBLIC_KEY environment variable.');
});

test('verify throws when LICENSE_PUBLIC_KEY is not a string', async () => {
	vi.mocked(useEnv).mockReturnValue({ LICENSE_PUBLIC_KEY: 123 } as any);

	await expect(verify('jwt-token')).rejects.toThrow('Missing or invalid LICENSE_PUBLIC_KEY environment variable.');
});

test('verify imports public key and verifies token', async () => {
	const pem = '-----BEGIN PUBLIC KEY-----ABC-----END PUBLIC KEY-----';

	vi.mocked(useEnv).mockReturnValue({ LICENSE_PUBLIC_KEY: pem } as any);

	const key = Symbol('public-key') as any;
	vi.mocked(importSPKI).mockResolvedValue(key);

	const payload = { sub: 'user-id', plan: 'pro' };
	vi.mocked(jwtVerify).mockResolvedValue({ payload } as any);

	const result = await verify('jwt-token');

	expect(importSPKI).toHaveBeenCalledWith(pem, 'Ed25519');
	expect(jwtVerify).toHaveBeenCalledWith('jwt-token', key, { algorithms: ['Ed25519'] });
	expect(result).toEqual(payload);
});

test('verify propagates errors from jwtVerify', async () => {
	const pem = '-----BEGIN PUBLIC KEY-----ABC-----END PUBLIC KEY-----';

	vi.mocked(useEnv).mockReturnValue({ LICENSE_PUBLIC_KEY: pem } as any);

	const key = Symbol('public-key') as any;
	vi.mocked(importSPKI).mockResolvedValue(key);

	vi.mocked(jwtVerify).mockRejectedValue(new Error('invalid token'));

	await expect(verify('jwt-token')).rejects.toThrow('invalid token');
});

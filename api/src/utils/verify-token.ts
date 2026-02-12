import { useEnv } from '@directus/env';
import { importSPKI, jwtVerify } from 'jose';

export async function verify(token: string) {
	const env = useEnv();
	const publicKey = env['LICENSE_PUBLIC_KEY'];

	if (typeof publicKey !== 'string' || !publicKey) {
		throw new Error('Missing or invalid LICENSE_PUBLIC_KEY environment variable.');
	}

	const key = await importSPKI(publicKey, 'Ed25519');

	const { payload } = await jwtVerify(token, key, {
		algorithms: ['Ed25519'],
	});

	return payload;
}

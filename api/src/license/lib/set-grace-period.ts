import { differenceInMilliseconds } from 'date-fns';
import { now } from 'lodash-es';
import { setTTLCacheTokenPayload } from '../../utils/cache-token-payload.js';

export async function setGracePeriod(gracePeriod: Date | undefined) {
	let ttl = 7 * 24 * 60 * 60 * 1000;

	if (gracePeriod) {
		ttl = differenceInMilliseconds(gracePeriod, now());
	}

	await setTTLCacheTokenPayload(ttl);
}

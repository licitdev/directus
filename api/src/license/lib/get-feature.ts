import type { Knex } from 'knex';
import { get, has } from 'lodash-es';
import type { GetCachedPayloadOptions } from '../types/get-cached-payload.js';
import { getCachedPayload } from './get-cached-payload.js';

/**
 * Returns the value at the given dot-notation path in the cached payload (e.g. "featureB.maxRoles").
 * Preserves original data types. Throws if the field does not exist.
 */
export async function getFeature(path: string, knex?: Knex, options?: GetCachedPayloadOptions): Promise<unknown> {
	if (!path) {
		throw new Error('path must not be empty');
	}

	const payload = await getCachedPayload(knex, options);

	if (payload === null) {
		throw new Error(`License payload not available`);
	}

	if (!has(payload as object, path)) {
		throw new Error(`License field does not exist: ${path}`);
	}

	return get(payload as object, path);
}

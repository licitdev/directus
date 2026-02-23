import type { Knex } from 'knex';
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

	const parts = path.split('.');
	let current: unknown = payload;

	for (const key of parts) {
		if (current === null || current === undefined || typeof current !== 'object') {
			throw new Error(`License field does not exist: ${path}`);
		}

		if (!(key in (current as Record<string, unknown>))) {
			throw new Error(`License field does not exist: ${path}`);
		}

		current = (current as Record<string, unknown>)[key];
	}

	return current;
}

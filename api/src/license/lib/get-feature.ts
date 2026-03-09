import { get, has, merge } from 'lodash-es';
import { defaultEntitlements } from '../defaults.js';
import type { Entitlements } from '../types/entitlements.js';
import { getLicensePayload } from './get-license-payload.js';

export async function getFeature<T>(featureName: string): Promise<T> {
	if (!featureName) {
		throw new Error('Feature name must not be empty');
	}

	const payload = await getLicensePayload();

	const featurePath = `metadata.entitlements.${featureName}`;
	const defaultPayload = defaultEntitlements[featureName as keyof Entitlements] ?? {};

	let featurePayload: unknown;

	const entitlements = get(payload, 'metadata.entitlements');

	if (Array.isArray(entitlements)) {
		const entry = entitlements.find((e: Record<string, unknown>) => e['name'] === featureName);

		if (entry) {
			const { name: _name, ...rest } = entry as Record<string, unknown>;
			featurePayload = rest;
		}
	} else {
		if (has(payload, featurePath)) {
			featurePayload = get(payload, featurePath);
		}
	}

	return merge({}, defaultPayload, featurePayload) as T;
}

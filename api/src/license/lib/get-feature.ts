import { get, has, merge } from 'lodash-es';
import { defaultEntitlements } from '../defaults.js';
import type { Entitlements } from '../types/entitlements.js';
import { getLicensePayload } from './get-license-payload.js';

export async function getFeature<T>(featureName: string): Promise<T> {
	if (!featureName) {
		throw new Error('Feature name must not be empty');
	}

	const payload = await getLicensePayload();

	if (!payload) {
		throw new Error('License payload is not found');
	}

	const featurePath = `metadata.entitlements.${featureName}`;
	const defaultPayload = defaultEntitlements[featureName as keyof Entitlements];

	let featurePayload: unknown;

	const entitlements = get(payload, 'metadata.entitlements');

	if (Array.isArray(entitlements)) {
		const entry = entitlements.find((e: Record<string, unknown>) => e['name'] === featureName);

		if (!entry) {
			throw new Error(`Feature "${featureName}" does not exist in license entitlements`);
		}

		const { name: _name, ...rest } = entry as Record<string, unknown>;
		featurePayload = rest;
	} else {
		if (!has(payload, featurePath) && defaultPayload === undefined) {
			throw new Error(`Feature "${featureName}" does not exist in license entitlements`);
		}

		featurePayload = get(payload, featurePath);
	}

	const mergedPayload = merge({}, defaultPayload ?? {}, featurePayload);

	return mergedPayload as T;
}

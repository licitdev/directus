import { DEFAULT_ENTITLEMENT_FEATURES } from '@directus/constants';
import { get, has } from 'lodash-es';
import { getLicensePayload } from './get-license-payload.js';

export async function getFeature<T = unknown>(featureName: string): Promise<T> {
	if (!featureName) {
		throw new Error('Feature name must not be empty');
	}

	const payload = await getLicensePayload();

	const featurePath = `metadata.entitlements.${featureName}`;
	const defaultFallback = get(DEFAULT_ENTITLEMENT_FEATURES, featureName) as T | undefined;

	if (!has(payload, featurePath) && !defaultFallback) {
		throw new Error(`Feature "${featureName}" does not exist in license entitlements`);
	}

	return get(payload, featurePath, defaultFallback) as T;
}

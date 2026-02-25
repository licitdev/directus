import { get, has } from 'lodash-es';
import { getLicensePayload } from './get-license-payload.js';

export async function getFeature(featureName: string): Promise<Record<string, unknown>> {
	if (!featureName) {
		throw new Error('Feature name must not be empty');
	}

	const payload = await getLicensePayload();

	if (!payload) {
		throw new Error('License payload is not found');
	}

	const featurePath = `metadata.entitlements.${featureName}`;

	if (!has(payload, featurePath)) {
		throw new Error(`Feature "${featureName}" does not exist in license entitlements`);
	}

	return get(payload, featurePath) as Record<string, unknown>;
}

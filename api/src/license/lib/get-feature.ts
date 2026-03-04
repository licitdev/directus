import { get, has } from 'lodash-es';
import { getLicensePayload } from './get-license-payload.js';

export async function getFeature<T = unknown>(featureName: string): Promise<T> {
	if (!featureName) {
		throw new Error('Feature name must not be empty');
	}

	const payload = await getLicensePayload();

	if (!payload) {
		throw new Error('License payload is not found');
	}

	const entitlements = get(payload, 'metadata.entitlements');

	if (Array.isArray(entitlements)) {
		const entry = entitlements.find((e: Record<string, unknown>) => e['name'] === featureName);

		if (!entry) {
			throw new Error(`Feature "${featureName}" does not exist in license entitlements`);
		}

		const { name: _name, ...rest } = entry as Record<string, unknown>;
		return rest as T;
	}

	const featurePath = `metadata.entitlements.${featureName}`;

	if (!has(payload, featurePath)) {
		throw new Error(`Feature "${featureName}" does not exist in license entitlements`);
	}

	return get(payload, featurePath) as T;
}

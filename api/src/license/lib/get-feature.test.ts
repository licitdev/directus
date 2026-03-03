import { afterEach, describe, expect, test, vi } from 'vitest';
import { getFeature } from './get-feature.js';
import { getLicensePayload } from './get-license-payload.js';

vi.mock('./get-license-payload.js');

afterEach(() => {
	vi.clearAllMocks();
});

describe('getFeature', () => {
	test('throws when feature name is empty', async () => {
		await expect(getFeature('')).rejects.toThrow('Feature name must not be empty');
	});

	test('returns feature data when payload contains the feature', async () => {
		const cachedPayload = {
			metadata: {
				entitlements: {
					featureA: { key1: 'value1' },
				},
			},
		};

		vi.mocked(getLicensePayload).mockResolvedValue(cachedPayload);

		const result = await getFeature('featureA');

		expect(result).toEqual({ key1: 'value1' });
	});

	test('throws when license payload is not found', async () => {
		vi.mocked(getLicensePayload).mockResolvedValue(undefined);

		await expect(getFeature('featureA')).rejects.toThrow('License payload is not found');
	});

	test('throws when feature does not exist in entitlements', async () => {
		const cachedPayload = {
			metadata: {
				entitlements: {
					otherFeature: { key1: 'value1' },
				},
			},
		};

		vi.mocked(getLicensePayload).mockResolvedValue(cachedPayload);

		await expect(getFeature('missingFeature')).rejects.toThrow(
			'Feature "missingFeature" does not exist in license entitlements',
		);
	});
});

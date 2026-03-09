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

	test('returns default entitlements when payload is not found', async () => {
		vi.mocked(getLicensePayload).mockResolvedValue(undefined);

		const result = await getFeature<{ limit: number; warningLimit: number }>('collections');

		expect(result).toEqual({ limit: 10, warningLimit: 5 });
	});

	test('returns default entitlements when payload does not contain the feature but defaults do', async () => {
		const cachedPayload = {
			metadata: {
				entitlements: {},
			},
		};

		vi.mocked(getLicensePayload).mockResolvedValue(cachedPayload);

		const result = await getFeature<{ limit: number }>('collections');

		expect(result).toEqual({ limit: 10, warningLimit: 5 });
	});

	test('returns empty object for unknown feature with no defaults', async () => {
		vi.mocked(getLicensePayload).mockResolvedValue(undefined);

		const result = await getFeature('featureA');

		expect(result).toEqual({});
	});

	test('merges default entitlements with payload, giving payload precedence', async () => {
		const cachedPayload = {
			metadata: {
				entitlements: {
					collections: { limit: 25 },
				},
			},
		};

		vi.mocked(getLicensePayload).mockResolvedValue(cachedPayload);

		const result = await getFeature<{ limit: number }>('collections');

		expect(result).toEqual({ limit: 25, warningLimit: 5 });
	});

	describe('object format entitlements', () => {
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

		test('returns defaults when feature does not exist in entitlements', async () => {
			const cachedPayload = {
				metadata: {
					entitlements: {
						otherFeature: { key1: 'value1' },
					},
				},
			};

			vi.mocked(getLicensePayload).mockResolvedValue(cachedPayload);

			const result = await getFeature('missingFeature');

			expect(result).toEqual({});
		});
	});

	describe('array format entitlements (licensing-service current format)', () => {
		test('returns feature metadata when found in array', async () => {
			const cachedPayload = {
				metadata: {
					entitlements: [{ name: 'featureA', key1: 'value1' }],
				},
			};

			vi.mocked(getLicensePayload).mockResolvedValue(cachedPayload);

			const result = await getFeature('featureA');

			expect(result).toEqual({ key1: 'value1' });
		});

		test('returns empty object for entitlement with no extra metadata', async () => {
			const cachedPayload = {
				metadata: {
					entitlements: [{ name: 'sso' }],
				},
			};

			vi.mocked(getLicensePayload).mockResolvedValue(cachedPayload);

			const result = await getFeature('sso');

			expect(result).toEqual({});
		});

		test('returns defaults when feature does not exist in array', async () => {
			const cachedPayload = {
				metadata: {
					entitlements: [{ name: 'otherFeature' }],
				},
			};

			vi.mocked(getLicensePayload).mockResolvedValue(cachedPayload);

			const result = await getFeature('missingFeature');

			expect(result).toEqual({});
		});
	});
});

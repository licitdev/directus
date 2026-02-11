import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { LicensingService } from './lib/service.js';
import { getCachedPayload, getFeature, getToken, resetLicenseCache } from './index.js';

vi.mock('./lib/service.js', () => ({
	LicensingService: vi.fn(),
}));

vi.mock('./lib/use-license.js', () => ({
	getCachedPayload: vi.fn(),
	getFeature: vi.fn(),
	resetLicenseCache: vi.fn(),
	setLicenseCaches: vi.fn(),
}));

let mockVerify: ReturnType<typeof vi.fn>;

beforeEach(() => {
	mockVerify = vi.fn();

	vi.mocked(LicensingService).mockImplementation(
		() =>
			({
				verify: mockVerify,
			}) as any,
	);
});

afterEach(() => {
	vi.clearAllMocks();
});

test('getToken instantiates LicensingService and calls verify with params', async () => {
	mockVerify.mockResolvedValue({ license_token: 'stored-token' });

	const params = { license_key: 'my-key' };

	const result = await getToken(params);

	expect(LicensingService).toHaveBeenCalledTimes(1);
	expect(LicensingService).toHaveBeenCalledWith();
	expect(mockVerify).toHaveBeenCalledTimes(1);
	expect(mockVerify).toHaveBeenCalledWith(params);
	expect(result).toEqual({ license_token: 'stored-token' });
});

test('getToken returns the result of verify', async () => {
	const tokenPayload = { license_token: 'jwt-token-123' };
	mockVerify.mockResolvedValue(tokenPayload);

	const result = await getToken({ license_key: 'k' });

	expect(result).toBe(tokenPayload);
});

test('getToken propagates errors from verify', async () => {
	mockVerify.mockRejectedValue(new Error('Verification failed'));

	await expect(
		getToken({
			license_key: 'k',
			project_id: 'p',
			public_url: 'https://u.com',
		}),
	).rejects.toThrow('Verification failed');
});

test('getCachedPayload delegates to lib with undefined knex and options', async () => {
	const { getCachedPayload: getCachedPayloadFromLib } = await import('./lib/use-license.js');
	vi.mocked(getCachedPayloadFromLib).mockResolvedValue({ featureA: true });

	const result = await getCachedPayload();

	expect(getCachedPayloadFromLib).toHaveBeenCalledWith(undefined, undefined);
	expect(result).toEqual({ featureA: true });
});

test('getCachedPayload passes options to lib', async () => {
	const { getCachedPayload: getCachedPayloadFromLib } = await import('./lib/use-license.js');
	vi.mocked(getCachedPayloadFromLib).mockResolvedValue(null);

	await getCachedPayload({ detectTokenChange: true });

	expect(getCachedPayloadFromLib).toHaveBeenCalledWith(undefined, { detectTokenChange: true });
});

test('getFeature delegates to lib with path and options', async () => {
	const { getFeature: getFeatureFromLib } = await import('./lib/use-license.js');
	vi.mocked(getFeatureFromLib).mockResolvedValue(5);

	const result = await getFeature('featureB.maxRoles');

	expect(getFeatureFromLib).toHaveBeenCalledWith('featureB.maxRoles', undefined, undefined);
	expect(result).toBe(5);
});

test('getFeature passes options to lib', async () => {
	const { getFeature: getFeatureFromLib } = await import('./lib/use-license.js');
	vi.mocked(getFeatureFromLib).mockResolvedValue(true);

	await getFeature('featureA', { detectTokenChange: true });

	expect(getFeatureFromLib).toHaveBeenCalledWith('featureA', undefined, { detectTokenChange: true });
});

test('resetLicenseCache calls lib resetLicenseCache', async () => {
	const { resetLicenseCache: resetLicenseCacheFromLib } = await import('./lib/use-license.js');

	resetLicenseCache();

	expect(resetLicenseCacheFromLib).toHaveBeenCalledTimes(1);
});

import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { LicensingService } from './service.js';
import { getToken } from './index.js';

vi.mock('./service.js', () => ({
	LicensingService: vi.fn(),
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

	await expect(getToken({ license_key: 'k' })).rejects.toThrow('Verification failed');
});

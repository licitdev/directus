import { describe, expect, test } from 'vitest';
import { getLicenseStatus } from './license-status.js';

describe('getLicenseStatus', () => {
	test('returns "invalid" when metadata/license is missing', () => {
		expect(getLicenseStatus({})).toBe('invalid');
	});

	test('returns "revoked" when status is revoked', () => {
		const payload = { metadata: { license: { status: 'revoked' } } };
		expect(getLicenseStatus(payload)).toBe('revoked');
	});

	test('returns "suspended" when status is suspended', () => {
		const payload = { metadata: { license: { status: 'suspended' } } };
		expect(getLicenseStatus(payload)).toBe('suspended');
	});

	test('returns "valid" when no expiry is set', () => {
		const payload = { metadata: { license: {} } };
		expect(getLicenseStatus(payload)).toBe('valid');
	});

	test('returns "expired" when expiry has passed but within grace period', () => {
		const now = Date.now();
		const expiry = new Date(now - 1000).toISOString();
		const payload = { metadata: { license: { expiry, grace_period: 5000 } } };
		expect(getLicenseStatus(payload as any)).toBe('expired');
	});

	test('returns "locked" when expiry and grace period have passed', () => {
		const now = Date.now();
		const expiry = new Date(now - 10000).toISOString();
		const payload = { metadata: { license: { expiry, grace_period: 5000 } } };
		expect(getLicenseStatus(payload as any)).toBe('locked');
	});

	test('returns "valid" when expiry is in the future', () => {
		const now = Date.now();
		const expiry = new Date(now + 10000).toISOString();
		const payload = { metadata: { license: { expiry } } };
		expect(getLicenseStatus(payload as any)).toBe('valid');
	});
});

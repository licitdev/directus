const DEFAULT_GRACE_MS = 7 * 24 * 60 * 60 * 1000;

export type LicenseStatus = 'missing' | 'valid' | 'expired' | 'locked' | 'revoked' | 'suspended' | 'invalid';

function getLicenseMeta(payload: Record<string, unknown>): Record<string, unknown> | undefined {
	const licenseMeta = payload?.['metadata'] as Record<string, unknown> | undefined;
	return licenseMeta?.['license'] as Record<string, unknown> | undefined;
}

function getExpiryStatus(expiry: string, gracePeriod: number): LicenseStatus {
	const now = Date.now();
	const expiryTime = new Date(expiry).getTime();
	if (now > expiryTime + gracePeriod) return 'locked';
	if (now > expiryTime) return 'expired';
	return 'valid';
}

export function isLicenseLocked(payload: Record<string, unknown>): boolean {
	const license = getLicenseMeta(payload);
	if (!license) return false;

	const expiry = license['expiry'] as string | undefined;
	if (!expiry) return false;

	const gracePeriod = (license['grace_period'] as number) ?? DEFAULT_GRACE_MS;

	return getExpiryStatus(expiry, gracePeriod) === 'locked';
}

export function getLicenseStatus(payload: Record<string, unknown> | undefined): LicenseStatus {
	if (!payload) return 'invalid';

	const license = getLicenseMeta(payload);
	if (!license) return 'invalid';

	const status = String(license['status']).toLowerCase() as LicenseStatus;
	if (status === 'revoked' || status === 'suspended') return status;

	const expiry = license['expiry'] as string;
	if (!expiry) return 'valid';

	const gracePeriod = (license['grace_period'] as number) ?? DEFAULT_GRACE_MS;

	return getExpiryStatus(expiry, gracePeriod);
}

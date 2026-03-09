const DEFAULT_GRACE_MS = 7 * 24 * 60 * 60 * 1000;

function getLicenseMeta(payload: Record<string, unknown>): Record<string, unknown> | undefined {
	const licenseMeta = payload?.['metadata'] as Record<string, unknown> | undefined;
	return licenseMeta?.['license'] as Record<string, unknown> | undefined;
}

/**
 * Check if license is locked (expired and grace period has passed).
 * grace_period is in milliseconds.
 */
export function isLicenseLocked(payload: Record<string, unknown>): boolean {
	const license = getLicenseMeta(payload);
	if (!license) return false;

	const expiry = license['expiry'] as string | undefined;
	const gracePeriod = (license['grace_period'] as number) ?? DEFAULT_GRACE_MS;
	if (!expiry) return false;

	const graceEndTime = new Date(expiry).getTime() + gracePeriod;
	return Date.now() > graceEndTime;
}

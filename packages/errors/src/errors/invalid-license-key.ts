import { createError, ErrorCode } from '../index.js';

export interface InvalidLicenseKeyErrorExtensions {
	reason?: string;
	statusCode?: number;
}

export const messageConstructor = (extensions: InvalidLicenseKeyErrorExtensions) =>
	extensions.reason ?? 'Invalid license key.';

export const InvalidLicenseKeyError = createError<InvalidLicenseKeyErrorExtensions>(
	ErrorCode.InvalidLicenseKey,
	messageConstructor,
	403,
);

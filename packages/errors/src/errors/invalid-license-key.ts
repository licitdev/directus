import { createError, type DirectusErrorConstructor, ErrorCode } from '../index.js';

export interface InvalidLicenseKeyErrorExtensions {
	reason?: string;
	statusCode?: number;
}

export const messageConstructor = (extensions: InvalidLicenseKeyErrorExtensions): string =>
	extensions.reason ?? 'Invalid license key.';

export const InvalidLicenseKeyError: DirectusErrorConstructor<InvalidLicenseKeyErrorExtensions> =
	createError<InvalidLicenseKeyErrorExtensions>(ErrorCode.InvalidLicenseKey, messageConstructor, 403);

import { createError, type DirectusErrorConstructor, ErrorCode } from '../index.js';

export const InvalidLicenseTokenError: DirectusErrorConstructor<void> = createError(
	ErrorCode.InvalidLicenseToken,
	'Missing or invalid license token.',
	403,
);

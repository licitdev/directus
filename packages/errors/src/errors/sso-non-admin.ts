import { createError, type DirectusErrorConstructor, ErrorCode } from '../index.js';

export const SsoNonAdminError: DirectusErrorConstructor<void> = createError(
	ErrorCode.SsoNonAdmin,
	'SSO login is restricted to admin users only.',
	403,
);

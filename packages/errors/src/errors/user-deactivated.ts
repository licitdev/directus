import { createError, type DirectusErrorConstructor, ErrorCode } from '../index.js';

export const UserDeactivatedError: DirectusErrorConstructor<void> = createError(
	ErrorCode.UserDeactivated,
	'User deactivated.',
	401,
);

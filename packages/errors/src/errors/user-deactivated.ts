import { createError, ErrorCode } from '../index.js';

export const UserDeactivatedError = createError(ErrorCode.UserDeactivated, 'User deactivated.', 401);

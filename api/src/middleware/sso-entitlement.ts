import { ForbiddenError } from '@directus/errors';
import { getDatabase } from '../database/index.js';
import { getFeature } from '../license/index.js';
import { Entitlements } from '../license/types/index.js';
import { useLogger } from '../logger/index.js';
import asyncHandler from '../utils/async-handler.js';

const logger = useLogger();

export const ssoEntitlementCheck = asyncHandler(async (_req, _res, next) => {
	let isSSOEnabled = false;

	try {
		const ssoEntitlement = await getFeature<{ enabled?: boolean }>(Entitlements.SSO);
		const db = getDatabase();
		const settings = await db.select('sso_deactivated').from('directus_settings').first();

		isSSOEnabled = !!ssoEntitlement?.enabled || !settings?.sso_deactivated;
	} catch {
		logger.warn('[license] Failed to load SSO feature entitlements');
	}

	if (!isSSOEnabled) {
		throw new ForbiddenError();
	}

	return next();
});

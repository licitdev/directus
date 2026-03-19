import { Entitlements, type EntitlementsType } from './types/index.js';

export const DEFAULT_USERS_LIMIT = 10;
export const DEFAULT_USERS_WARNING_LIMIT = 5;
export const DEFAULT_COLLECTIONS_LIMIT = 10;
export const DEFAULT_COLLECTIONS_WARNING_LIMIT = 5;
export const DEFAULT_ACTIVITY_FEED_DAYS = 3;
export const DEFAULT_REVISIONS_DAYS = 3;
export const DEFAULT_SSO_ENABLED = false;
export const DEFAULT_CUSTOM_PERMISSIONS_ENABLED = false;
export const DEFAULT_LLM_ENABLED = false;

export const defaultEntitlements: EntitlementsType = {
	[Entitlements.COLLECTIONS]: {
		limit: DEFAULT_COLLECTIONS_LIMIT,
		warningLimit: DEFAULT_COLLECTIONS_WARNING_LIMIT,
	},
	[Entitlements.ACTIVITY_FEED]: {
		limit: DEFAULT_ACTIVITY_FEED_DAYS,
	},
	[Entitlements.REVISIONS]: {
		limit: DEFAULT_REVISIONS_DAYS,
	},
	[Entitlements.USERS]: {
		limit: DEFAULT_USERS_LIMIT,
		warningLimit: DEFAULT_USERS_WARNING_LIMIT,
	},
	[Entitlements.SSO]: {
		enabled: DEFAULT_SSO_ENABLED,
	},
	[Entitlements.CUSTOM_PERMISSIONS]: {
		enabled: DEFAULT_CUSTOM_PERMISSIONS_ENABLED,
	},
	[Entitlements.LLM]: {
		enabled: DEFAULT_LLM_ENABLED,
	},
};

import type { Entitlements as EntitlementsType } from './types/index.js';

export enum Entitlements {
	ACTIVITY_FEED = 'activity_feed',
	REVISIONS = 'revisions',
	COLLECTIONS = 'collections',
	USERS = 'users',
	SSO = 'sso',
}

export const DEFAULT_USERS_LIMIT = 10;
export const DEFAULT_COLLECTIONS_LIMIT = 10;
export const DEFAULT_COLLECTIONS_WARNING_LIMIT = 5;
export const DEFAULT_ACTIVITY_FEED_DAYS = 3;
export const DEFAULT_REVISIONS_DAYS = 3;
export const DEFAULT_SSO_ENABLED = true;

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
	},
	[Entitlements.SSO]: {
		enabled: DEFAULT_SSO_ENABLED,
	},
};

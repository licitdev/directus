import type { Entitlements } from './types/index.js';

export const DEFAULT_COLLECTIONS_LIMIT = 10;
export const DEFAULT_COLLECTIONS_WARNING_LIMIT = 5;
export const DEFAULT_ACTIVITY_FEED_DAYS = 30;
export const DEFAULT_REVISIONS_DAYS = 30;

export const defaultEntitlements: Entitlements = {
	collections: {
		limit: DEFAULT_COLLECTIONS_LIMIT,
		warningLimit: DEFAULT_COLLECTIONS_WARNING_LIMIT,
	},
	activity_feed: {
		limit: DEFAULT_ACTIVITY_FEED_DAYS,
	},
	revisions: {
		limit: DEFAULT_REVISIONS_DAYS,
	},
};

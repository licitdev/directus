import type { Entitlements } from './types/index.js';

export const DEFAULT_COLLECTIONS_LIMIT = 10;
export const DEFAULT_COLLECTIONS_WARNING_LIMIT = 5;

export const defaultEntitlements: Entitlements = {
	collections: {
		limit: DEFAULT_COLLECTIONS_LIMIT,
		warningLimit: DEFAULT_COLLECTIONS_WARNING_LIMIT,
	},
};

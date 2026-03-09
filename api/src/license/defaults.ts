import type { Entitlements } from './types/index.js';

export enum Entitlement {
	COLLECTIONS = 'collections',
}

export const DEFAULT_COLLECTIONS_LIMIT = 10;
export const DEFAULT_COLLECTIONS_WARNING_LIMIT = 5;

export const defaultEntitlements: Entitlements = {
	[Entitlement.COLLECTIONS]: {
		limit: DEFAULT_COLLECTIONS_LIMIT,
		warningLimit: DEFAULT_COLLECTIONS_WARNING_LIMIT,
	},
};

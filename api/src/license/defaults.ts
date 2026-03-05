export enum Entitlements {
	ACTIVITY_FEED = 'activity_feed',
	REVISIONS = 'revisions',
	COLLECTIONS = 'collections',
}

export const defaultEntitlements: Record<string, unknown> = {
	[Entitlements.REVISIONS]: {
		limit: 30,
	},
	[Entitlements.ACTIVITY_FEED]: {
		limit: 30,
	},
	[Entitlements.COLLECTIONS]: {
		limit: 10,
	},
};

export enum Entitlements {
	ACTIVITY_FEED = 'activity_feed',
	REVISIONS = 'revisions',
}

export const DEFAULT_ENTITLEMENT_FEATURES = {
	[Entitlements.REVISIONS]: {
		limit: 30,
	},
	[Entitlements.ACTIVITY_FEED]: {
		limit: 30,
	},
};

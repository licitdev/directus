export enum Entitlements {
	ACTIVITY_FEED = 'activity_feed',
	REVISIONS = 'revisions',
	COLLECTIONS = 'collections',
	USERS = 'users',
	SSO = 'sso',
	CUSTOM_PERMISSIONS = 'custom_permissions',
}

export type CollectionsEntitlements = {
	limit: number;
	warningLimit: number;
};

export type ActivityFeedEntitlements = {
	limit: number;
};

export type RevisionsEntitlements = {
	limit: number;
};

export type UsersEntitlements = {
	limit: number;
};

export type SSOEntitlements = {
	enabled: boolean;
};

export type EntitlementsType = {
	[Entitlements.COLLECTIONS]: CollectionsEntitlements;
	[Entitlements.ACTIVITY_FEED]: ActivityFeedEntitlements;
	[Entitlements.REVISIONS]: RevisionsEntitlements;
	[Entitlements.USERS]: UsersEntitlements;
	[Entitlements.SSO]: SSOEntitlements;
	[Entitlements.CUSTOM_PERMISSIONS]: SSOEntitlements;
};

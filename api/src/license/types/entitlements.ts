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

export type Entitlements = {
	collections: CollectionsEntitlements;
	activity_feed: ActivityFeedEntitlements;
	revisions: RevisionsEntitlements;
	users: UsersEntitlements;
};

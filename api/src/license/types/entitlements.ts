export type CollectionsEntitlements = {
	limit: number;
	warningLimit: number;
};

export type UsersEntitlements = {
	limit: number;
};

export type Entitlements = {
	collections: CollectionsEntitlements;
	users: UsersEntitlements;
};

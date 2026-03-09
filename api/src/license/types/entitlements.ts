export type CollectionsEntitlements = {
	limit: number;
	warningLimit: number;
};

export type UsersEntitlements = {
	limit: number;
};

export type SSOEntitlements = {
	enabled: boolean;
};

export type Entitlements = {
	collections: CollectionsEntitlements;
	users: UsersEntitlements;
	sso: SSOEntitlements;
};

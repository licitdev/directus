export type GetCachedPayloadOptions = {
	/** If true, re-fetch token from DB and reload when token differs from cached (supports token change detection). */
	detectTokenChange?: boolean;
};

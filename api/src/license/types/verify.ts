import type { Knex } from 'knex';

export type VerifyLicenseRequest = {
	/** License key to verify; defaults to 'directus-test' if omitted. */
	license_key?: string;
};

export type VerifyLicenseResponse = {
	license_token: string;
};

export type VerifyOptions = {
	/** Optional Knex instance; uses default DB if omitted. */
	knex?: Knex;
	/** When true (default), persist the token to directus_settings.license_token. When false, only update in-memory cache. */
	persist?: boolean;
};

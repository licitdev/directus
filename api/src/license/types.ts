export type VerifyLicenseRequest = {
	license_key: string;
};

export type VerifyLicenseResponse = {
	license_token: string;
};

export type GetTokenRequest = {
	license_key: string;
	project_id: string;
};

export type GetTokenResponse = {
	token: string;
};

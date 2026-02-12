export type VerifyLicenseRequest = {
	license_key: string;
	project_id: string;
	public_url: string;
};

export type VerifyLicenseResponse = {
	token: string;
};

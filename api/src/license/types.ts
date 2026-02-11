export type VerifyLicenseRequest = {
	license_key: string;
	project_id: string;
};

export type VerifyLicenseResponse = {
	token: string;
};

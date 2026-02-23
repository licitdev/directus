export type ValidateLicenseRequest = {
	license_key: string;
	project_id?: string;
	public_url: string;
};

export type ValidateLicenseResponse = {
	token: string;
};

export type ValidateLicenseRequest = {
	licenseKey: string;
	projectId?: string;
	publicUrl?: string;
};

export type ValidateLicenseResponse = {
	token: string;
	project_id: string;
};

export type ValidateLicenseRequest = {
	licenseKey: string;
	projectId?: string;
	publicUrl?: string;
};

export type ValidateLicenseResponse = {
	token: string;
	projectId: string;
};

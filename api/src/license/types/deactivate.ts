export type DeactivateLicenseRequest = {
	licenseKey: string;
	projectId?: string;
};

export type DeactivateLicenseResponse = {
	success: boolean;
};

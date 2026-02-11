import { LicensingService } from './service.js';
import type { VerifyLicenseRequestType } from './types/index.js';
import type { VerifyResponseType } from './types/response.js';

export async function getToken(params: VerifyLicenseRequestType): Promise<VerifyResponseType> {
	const service = new LicensingService();
	return service.verify(params);
}

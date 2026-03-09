import { validate } from './validate.js';

export async function validateAndGetToken(
	licenseKey: string,
	context: { projectId?: string; publicUrl: string },
): Promise<string> {
	const { token } = await validate({
		licenseKey,
		...(context.projectId && { projectId: context.projectId }),
		publicUrl: context.publicUrl,
	});

	return token;
}

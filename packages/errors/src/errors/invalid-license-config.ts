import { createError, ErrorCode } from '../index.js';

export interface InvalidLicenseConfigErrorExtensions {
	reason: string;
}

export const messageConstructor = ({ reason }: InvalidLicenseConfigErrorExtensions) =>
	`Missing or invalid license configuration. ${reason}.`;

export const InvalidLicenseConfigError = createError<InvalidLicenseConfigErrorExtensions>(
	ErrorCode.InvalidLicenseConfig,
	messageConstructor,
);

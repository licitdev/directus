export enum AUTH_DRIVERS {
	SAML = 'saml',
	LOCAL = 'local',
	LDAP = 'ldap',
	OAUTH2 = 'oauth2',
	OPENID = 'openid',
}

export const SSO_DRIVERS: string[] = [AUTH_DRIVERS.OAUTH2, AUTH_DRIVERS.OPENID, AUTH_DRIVERS.SAML, AUTH_DRIVERS.LDAP];

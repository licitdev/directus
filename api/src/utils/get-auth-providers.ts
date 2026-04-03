import { useEnv } from '@directus/env';
import { toArray } from '@directus/utils';
import { AUTH_DRIVERS } from '../auth/constants/auth.js';

interface AuthProvider {
	name: string;
	driver: string;
	icon?: string;
	label?: string;
}

type Props = {
	sessionOnly?: boolean;
};

export function getAuthProviders({ sessionOnly }: Props = { sessionOnly: false }): AuthProvider[] {
	const env = useEnv();

	let providers = toArray(env['AUTH_PROVIDERS'] as string).filter(
		(provider) => provider && env[`AUTH_${provider.toUpperCase()}_DRIVER`],
	);

	if (sessionOnly) {
		providers = providers.filter((provider) => {
			const driver = env[`AUTH_${provider.toUpperCase()}_DRIVER`] as string;

			// only the following 3 drivers require a mode selection
			const selectionRequiredDrivers = [AUTH_DRIVERS.OAUTH2, AUTH_DRIVERS.OPENID, AUTH_DRIVERS.SAML] as string[];

			if (selectionRequiredDrivers.includes(driver)) {
				const mode = env[`AUTH_${provider.toUpperCase()}_MODE`] as string | undefined;
				// if mode is not defined it defaults to session
				return !mode || mode === 'session';
			}

			return true;
		});
	}

	return providers.map((provider) => ({
		name: provider,
		label: env[`AUTH_${provider.toUpperCase()}_LABEL`] as string,
		driver: env[`AUTH_${provider.toUpperCase()}_DRIVER`] as string,
		icon: env[`AUTH_${provider.toUpperCase()}_ICON`] as string,
	}));
}

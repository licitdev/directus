import { useI18n } from 'vue-i18n';

export type AddonMetadata = {
	name: string;
	description: string;
	icon: string;
	type: 'numeric' | 'boolean';
	disabled?: boolean;
};

export function useAddonMetadata(): Record<string, AddonMetadata> {
	const { t } = useI18n();

	return {
		user_seats: {
			name: t('settings_license_addon_user_seats_name'),
			description: t('settings_license_addon_user_seats_description'),
			icon: 'group',
			type: 'numeric',
		},
		collections: {
			name: t('settings_license_addon_collections_name'),
			description: t('settings_license_addon_collections_description'),
			icon: 'deployed_code',
			type: 'numeric',
		},
		sso: {
			name: t('settings_license_addon_sso_name'),
			description: t('settings_license_addon_sso_description'),
			icon: 'cloud_lock',
			type: 'boolean',
		},
		basic_support: {
			name: t('settings_license_addon_basic_support_name'),
			description: '',
			icon: 'support_agent',
			type: 'boolean',
			disabled: true,
		},
	};
}

import api from '@/api';
import { Role } from '@directus/shared/types';
import { ref, Ref } from 'vue';
import { notEmpty } from '@/utils/is-empty/';
import { i18n } from '@/lang';

let roles: Ref<Role[] | null> | null = null;
let loading: Ref<boolean> | null = null;

export default function useNavigation(): { roles: Ref<Role[] | null>; loading: Ref<boolean> } {
	if (roles === null) {
		roles = ref<Role[] | null>(null);
	}

	if (loading === null) {
		loading = ref(false);
	}

	if (roles.value === null && loading?.value === false) {
		fetchRoles();
	}

	return { roles, loading };

	async function fetchRoles() {
		if (!loading || !roles) return;
		loading.value = true;

		const rolesResponse = await api.get(`/roles`, {
			params: {
				sort: 'name',
			},
		});
		roles.value = rolesResponse.data.data;

		if (roles.value !== null) {
			roles.value = roles.value.map((role: Role) => {
				if (role.translations && notEmpty(role.translations)) {
					for (let i = 0; i < role.translations.length; i++) {
						const { language, translation } = role.translations[i];

						i18n.global.mergeLocaleMessage(language, {
							role_names: {
								[role.name]: translation,
							},
						});
					}
				}
				return role;
			});
		}

		loading.value = false;
	}
}

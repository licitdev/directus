import { defineStore } from 'pinia';
import { ref } from 'vue';
import api from '@/api';
import { unexpectedError } from '@/utils/unexpected-error';

export const useUsersStore = defineStore('usersStore', () => {
	const activeUsersCount = ref<number | null>(null);
	const activeUsersCountLoading = ref(false);
	const activeUsersCountError = ref<unknown | null>(null);

	async function fetchActiveUsersCount() {
		activeUsersCountLoading.value = true;
		activeUsersCountError.value = null;

		try {
			const { data } = await api.get('/users', {
				params: {
					filter: {
						status: {
							_eq: 'active',
						},
					},
					limit: 0,
					meta: 'total_count',
				},
			});

			activeUsersCount.value = Number(data?.meta?.total_count ?? 0);
		} catch (error: unknown) {
			activeUsersCountError.value = error;
			unexpectedError(error);
		} finally {
			activeUsersCountLoading.value = false;
		}
	}

	return {
		activeUsersCount,
		activeUsersCountLoading,
		activeUsersCountError,
		fetchActiveUsersCount,
	};
});

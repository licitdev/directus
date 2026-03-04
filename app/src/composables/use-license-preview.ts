import { ref } from 'vue';
import api from '@/api';

export function useLicensePreview() {
	const previewPayload = ref<Record<string, any> | null>(null);
	const validating = ref(false);
	const validationError = ref<string | null>(null);

	async function fetchPreview(key: string) {
		validating.value = true;
		previewPayload.value = null;
		validationError.value = null;

		try {
			const res = await api.post('/server/check-license', { license_key: key });
			previewPayload.value = res.data.data ?? null;
		} catch (err: any) {
			validationError.value =
				err?.response?.data?.errors?.[0]?.message ?? err?.message ?? 'Validation failed';
		} finally {
			validating.value = false;
		}
	}

	function clearPreview() {
		previewPayload.value = null;
		validationError.value = null;
	}

	return { previewPayload, validating, validationError, fetchPreview, clearPreview };
}

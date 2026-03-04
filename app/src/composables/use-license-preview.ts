import { ref } from 'vue';
import api from '@/api';

export function useLicensePreview() {
	const previewPayload = ref<Record<string, any> | null>(null);
	const validating = ref(false);
	const validationError = ref(false);

	async function fetchPreview(key: string) {
		validating.value = true;
		previewPayload.value = null;
		validationError.value = false;

		try {
			const res = await api.post('/server/validate-license', { license_key: key });
			previewPayload.value = res.data.data ?? null;
		} catch {
			validationError.value = true;
		} finally {
			validating.value = false;
		}
	}

	function clearPreview() {
		previewPayload.value = null;
		validationError.value = false;
	}

	return { previewPayload, validating, validationError, fetchPreview, clearPreview };
}

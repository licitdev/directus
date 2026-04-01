<script setup lang="ts">
import { SetupForm as Form } from '@directus/types';
import { useHead } from '@unhead/vue';
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { defaultValues, FormValidator, useFormFields, validate, ValidationError } from './form';
import SetupForm from './form.vue';
import api from '@/api';
import { login } from '@/auth';
import VButton from '@/components/v-button.vue';
import VIcon from '@/components/v-icon/v-icon.vue';
import VNotice from '@/components/v-notice.vue';
import { translateAPIError } from '@/lang';
import LicenseKeyInput from '@/modules/licensing/components/license-key-input.vue';
import { useServerStore } from '@/stores/server';
import PublicView from '@/views/public';

const { t } = useI18n();
const { info } = useServerStore();

useHead({
	title: t('setup_project'),
});

const step = ref<1 | 2>(1);
const form = ref<Form>(defaultValues);
const router = useRouter();

const fields = useFormFields(true, form);
const fieldsStep1 = useFormFields(true, form, undefined, ref(true));

const errors = ref<ValidationError[]>([]);
const error = ref<any>(null);
const isSaving = ref(false);

const showLicenseKeyField = computed(() => info.show_license_key_field ?? true);

const formStep1Complete = computed(() => {
	return FormValidator.safeParse({ ...form.value, license_key: null }).success;
});

const formComplete = computed(() => FormValidator.safeParse(form.value).success);

function goToStep2() {
	errors.value = validate(form.value, fieldsStep1, true);
	if (errors.value.length > 0) return;

	if (!showLicenseKeyField.value) {
		launch();
		return;
	}

	step.value = 2;
}

async function launch() {
	const validationFields = showLicenseKeyField.value ? fields : fieldsStep1;
	errors.value = validate(form.value, validationFields, true);

	if (errors.value.length > 0) return;

	try {
		isSaving.value = true;
		await api.post('server/setup', form.value);

		await login({
			credentials: {
				email: form.value.project_owner!,
				password: form.value.password!,
			},
		});

		router.push('/content');
	} catch (err: any) {
		error.value = err;
	} finally {
		isSaving.value = false;
	}
}

const errorMessage = computed(() => {
	return error.value?.response?.data?.errors?.[0]?.message || error.value?.message || t('unexpected_error');
});

watch(form, () => {
	if (form.value.project_usage !== 'commercial') {
		form.value.org_name = null;
	}
});
</script>

<template>
	<PublicView wide>
		<template v-if="step === 1">
			<SetupForm v-model="form" :errors="errors" utm-location="onboarding" hide-license-key />

			<template v-if="showLicenseKeyField">
				<VButton full-width :disabled="!formStep1Complete" @click="goToStep2()">
					<VIcon name="arrow_forward" />
					{{ $t('setup_continue') }}
				</VButton>
			</template>
			<template v-else>
				<VNotice v-if="error" type="danger">
					<p class="error-code">{{ translateAPIError(error) }}</p>
					<p>{{ errorMessage }}</p>
				</VNotice>
				<VButton full-width :disabled="!formStep1Complete" :loading="isSaving" @click="goToStep2()">
					<VIcon name="rocket_launch" />
					{{ $t('setup_launch') }}
				</VButton>
			</template>
		</template>

		<template v-else>
			<div class="license-step">
				<h1>{{ $t('setup_welcome') }}</h1>
				<p>{{ $t('setup_license_key_info') }}</p>

				<LicenseKeyInput v-model="form.license_key" :utm-term="info.version" utm-content="onboarding" />
			</div>

			<VNotice v-if="error" type="danger">
				<p class="error-code">{{ translateAPIError(error) }}</p>
				<p>{{ errorMessage }}</p>
			</VNotice>

			<div class="step2-actions">
				<VButton secondary @click="step = 1">
					{{ $t('back') }}
				</VButton>
				<VButton :disabled="!formComplete" :loading="isSaving" @click="launch()">
					<VIcon name="rocket_launch" />
					{{ $t('setup_launch') }}
				</VButton>
			</div>
		</template>
	</PublicView>
</template>

<style scoped>
.setup-form {
	margin-block-start: 5.625rem;
}

.v-button:not(.secondary) {
	margin-block-start: 1.8125rem;

	.v-icon {
		margin-inline-end: 0.6875rem;
	}
}

.v-notice {
	margin-block-start: 1.375rem;
}

.error-code {
	font-weight: 700;
	margin-block-end: 0.25rem;
}

/* Step 2 */
.license-step {
	h1 {
		color: var(--theme--foreground-accent);
		font-size: 2.5rem;
		font-weight: 600;
		line-height: 3rem;
		margin-block-end: 1.5rem;
	}

	p {
		font-size: 0.875rem;
		font-weight: 500;
		line-height: 1.25rem;
		margin-block-end: 0;
	}

	.license-key-input {
		margin-block-start: 1.5rem;
	}
}

.step2-actions {
	display: flex;
	gap: 0.75rem;
	margin-block-start: 2rem;

	.v-button {
		margin-block-start: 0;
		flex: 1;
	}
}
</style>

<script setup lang="ts">
import { watchDebounced } from '@vueuse/core';
import { storeToRefs } from 'pinia';
import { computed, ref, watch } from 'vue';
import { I18nT, useI18n } from 'vue-i18n';
import VIcon from '@/components/v-icon/v-icon.vue';
import VInput from '@/components/v-input.vue';
import VNotice from '@/components/v-notice.vue';
import VProgressCircular from '@/components/v-progress-circular.vue';
import { useLicensePreview } from '@/composables/use-license-preview';
import { useServerStore } from '@/stores/server';

const { t } = useI18n();
const { info } = storeToRefs(useServerStore());

const props = withDefaults(
	defineProps<{
		utmTerm?: string;
		utmContent?: string;
		hasExistingKey?: boolean;
		licensePayload?: Record<string, any> | null;
	}>(),
	{
		utmTerm: '',
		utmContent: '',
		hasExistingKey: false,
		licensePayload: null,
	},
);

const modelValue = defineModel<string | null>({ default: null });
const inputValue = ref<string | undefined>(modelValue.value ?? undefined);

const { previewPayload, validating, validationError, fetchPreview, clearPreview } = useLicensePreview();

watch(modelValue, (val) => {
	inputValue.value = val ?? undefined;
	if (!val) clearPreview();
});

watchDebounced(
	inputValue,
	async (val) => {
		const normalized = val?.trim() || null;
		if (normalized !== modelValue.value) modelValue.value = normalized;
		if (normalized) await fetchPreview(normalized);
		else clearPreview();
	},
	{ debounce: 400 },
);

const activePayload = computed(() => props.licensePayload ?? previewPayload.value);

const inputPlaceholder = computed(() =>
	props.hasExistingKey ? t('license_key_masked_placeholder') : t('license_key_placeholder'),
);

const expiryFormatted = computed(() => activePayload.value?.expiry?.slice(0, 10) ?? null);
const tierName = computed(() => activePayload.value?.policy ?? null);
const showStatus = computed(() => Boolean(activePayload.value?.valid));
</script>

<template>
	<div class="license-key-input">
		<VNotice class="license-notice">
			<I18nT keypath="setup_license_key_notice" tag="span">
				<template #learnMore>
					<a
						:href="`https://directus.io/license-request?utm_source=self_hosted&utm_medium=product&utm_campaign=2025_10_kyc&utm_term=${utmTerm}&utm_content=${utmContent}_learn_more_link`"
						target="_blank"
					>
						{{ t('setup_learn_more') }}
					</a>
				</template>
			</I18nT>
		</VNotice>

		<div v-if="info.show_license_key_field ?? true" class="license-field">
			<label class="license-label">
				{{ t('license_key') }}
				<span class="optional">({{ t('setup_optional') }})</span>
			</label>

			<VInput v-model="inputValue" :placeholder="inputPlaceholder" nullable>
				<template v-if="validating" #append>
					<VProgressCircular class="spinner" small indeterminate />
				</template>
			</VInput>

			<div v-if="validationError" class="validation-status">
				<span class="status-item status-invalid">
					<VIcon name="cancel" class="status-icon status-icon--error" />
					{{ validationError || t('license_invalid') }}
				</span>
			</div>

			<div v-else-if="showStatus" class="validation-status">
				<span class="status-item">
					<VIcon name="check_circle" class="status-icon" />
					{{ t('license_valid') }}
				</span>
				<span v-if="tierName" class="status-item">
					<VIcon name="check_circle" class="status-icon" />
					{{ tierName }}
				</span>
				<span v-if="expiryFormatted" class="status-item">
					<VIcon name="check_circle" class="status-icon" />
					{{ t('license_expires_on', { date: expiryFormatted }) }}
				</span>
			</div>
		</div>
	</div>
</template>

<style scoped>
.license-key-input {
	display: grid;
	gap: 0;
}

.license-notice {
	margin-block-end: 24px;

	:deep(a) {
		color: var(--theme--primary);
		text-decoration: underline;
	}
}

.license-field {
	display: grid;
	gap: 8px;
}

.license-label {
	font-size: 14px;
	font-weight: 600;
	color: var(--theme--foreground);

	.optional {
		color: var(--theme--primary);
		font-weight: 400;
		margin-inline-start: 4px;
	}
}

.validation-status {
	display: grid;
	grid-template-columns: 1fr 1fr;
	gap: 4px 16px;
	margin-block-start: 4px;
}

.spinner {
	--v-progress-circular-color: var(--theme--foreground-subdued);
	margin-inline-end: 8px;
}

.status-item {
	display: flex;
	align-items: center;
	gap: 6px;
	font-size: 13px;
	color: var(--theme--success);

	&.status-invalid {
		color: var(--theme--danger);
	}
}

.status-icon {
	--v-icon-size: 16px;
	--v-icon-color: var(--theme--success);
	flex-shrink: 0;

	&--error {
		--v-icon-color: var(--theme--danger);
	}
}
</style>

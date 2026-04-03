<script lang="ts" setup>
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import VButton from '@/components/v-button.vue';
import VCardActions from '@/components/v-card-actions.vue';
import VCardTitle from '@/components/v-card-title.vue';
import VCard from '@/components/v-card.vue';
import VDialog from '@/components/v-dialog.vue';
import VIcon from '@/components/v-icon/v-icon.vue';
import VInput from '@/components/v-input.vue';

type AddonInfo = {
	type: 'numeric' | 'boolean';
	title: string;
	min?: number;
	max?: number;
	helperText?: string;
};

const props = defineProps<{
	addonId: string;
	modelValue?: boolean;
}>();

const emit = defineEmits<{
	'update:modelValue': [value: boolean];
}>();

const { t } = useI18n();
const router = useRouter();

const addonData: Record<string, AddonInfo> = {
	user_seats: {
		type: 'numeric',
		title: t('settings_license_addon_user_seats_title'),
		min: 1,
		max: 10,
	},
	sso: { title: t('settings_license_addon_sso_title'), type: 'boolean' },
	collections: {
		title: t('settings_license_addon_collections_title'),
		type: 'numeric',
		min: 1,
		max: 10,
		helperText: t('settings_license_addon_collections_helper_text'),
	},
	basic_support: { title: t('settings_license_addon_basic_support_title'), type: 'boolean' },
};

const addonInfo = computed(() => addonData[props.addonId]);

const quantity = ref(addonInfo.value?.type === 'numeric' ? (addonInfo.value?.min ?? 1) : 1);

watch(addonInfo, (info) => {
	quantity.value = info?.type === 'numeric' ? (info.min ?? 1) : 1;
});

function cancel() {
	emit('update:modelValue', false);
}

function confirm() {
	emit('update:modelValue', false);

	//TODO: Update this when have more infor
	router.push('https://directus.io/license-request');
}
</script>

<template>
	<VDialog :model-value="modelValue" @update:model-value="emit('update:modelValue', $event)">
		<VCard class="purchase-addon-modal">
			<!-- Boolean addon: confirmation message only -->
			<template v-if="addonInfo?.type === 'boolean'">
				<VCardTitle class="modal-title modal-title--confirm">{{ addonInfo.title }}</VCardTitle>
			</template>

			<!-- Numeric addon: title + quantity input -->
			<template v-else>
				<VCardTitle class="modal-title">
					{{ addonInfo?.title ?? 'Additional Collections Pack(s)' }}
				</VCardTitle>

				<div class="modal-body">
					<VInput
						v-model="quantity"
						type="number"
						:min="addonInfo?.min ?? 1"
						:max="addonInfo?.max"
						:step="1"
						integer
						class="quantity-input"
					>
						<template #prepend>
							<VIcon name="storage" class="input-icon" />
						</template>
					</VInput>

					<p v-if="addonInfo?.helperText" class="helper-text">
						{{ addonInfo?.helperText }}
					</p>
				</div>
			</template>

			<VCardActions class="modal-actions">
				<VButton secondary large class="cancel-btn" @click="cancel">{{ $t('cancel') }}</VButton>
				<VButton large class="confirm-btn" @click="confirm">
					{{ $t('settings_license_addon_confirm_purchase') }}
				</VButton>
			</VCardActions>
		</VCard>
	</VDialog>
</template>

<style lang="scss" scoped>
.purchase-addon-modal {
	inline-size: 41.25rem;
	padding: 0.5rem;
}

.modal-title {
	font-size: 1.25rem;
	font-weight: 700;
	color: var(--theme--foreground);
	padding: 1rem 1rem 1.25rem;

	&--confirm {
		padding-block-end: 2rem;
	}
}

.modal-body {
	padding: 0 1rem 1rem;
	display: flex;
	flex-direction: column;
	gap: 0.75rem;
}

.quantity-input {
	:deep(.input) {
		block-size: 4rem;
		border-radius: 0.75rem;
		border-color: var(--theme--border-color);
	}

	:deep(.prepend) {
		padding-inline-start: 1rem;
	}
}

.input-icon {
	color: var(--theme--primary-subdued);
}

.helper-text {
	font-style: italic;
	color: var(--theme--primary-subdued);
	font-size: 0.875rem;
	margin: 0;
	padding-inline-start: 0.25rem;
}

.modal-actions {
	display: flex;
	justify-content: flex-end;
	gap: 0.75rem;
	padding: 1rem;
}

.cancel-btn {
	min-inline-size: 10rem;
}

.confirm-btn {
	min-inline-size: 13.75rem;

	--v-button-background-color: #4f46e5;
	--v-button-background-color-hover: #4338ca;
	--v-button-color: #fff;
}
</style>

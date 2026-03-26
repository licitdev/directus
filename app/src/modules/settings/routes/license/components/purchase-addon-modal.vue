<script lang="ts" setup>
import { ref } from 'vue';
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

const addonInfo = ref(props.addonId ? addonData[props.addonId] : undefined);

const quantity = ref(addonInfo.value?.type === 'numeric' ? (addonInfo.value?.min ?? 1) : 1);

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
				<VButton secondary large class="cancel-btn" @click="cancel">Cancel</VButton>
				<VButton large class="confirm-btn" @click="confirm">Confirm Purchase</VButton>
			</VCardActions>
		</VCard>
	</VDialog>
</template>

<style lang="scss" scoped>
.purchase-addon-modal {
	inline-size: 660px;
	padding: 8px;
}

.modal-title {
	font-size: 20px;
	font-weight: 700;
	color: var(--theme--foreground);
	padding: 16px 16px 20px;

	&--confirm {
		padding-block-end: 32px;
	}
}

.modal-body {
	padding: 0 16px 16px;
	display: flex;
	flex-direction: column;
	gap: 12px;
}

.quantity-input {
	:deep(.input) {
		block-size: 64px;
		border-radius: 12px;
		border-color: var(--theme--border-color);
	}

	:deep(.prepend) {
		padding-inline-start: 16px;
	}
}

.input-icon {
	color: var(--theme--primary-subdued);
}

.helper-text {
	font-style: italic;
	color: var(--theme--primary-subdued);
	font-size: 14px;
	margin: 0;
	padding-inline-start: 4px;
}

.modal-actions {
	display: flex;
	justify-content: flex-end;
	gap: 12px;
	padding: 16px;
}

.cancel-btn {
	min-inline-size: 160px;
}

.confirm-btn {
	min-inline-size: 220px;

	--v-button-background-color: #4f46e5;
	--v-button-background-color-hover: #4338ca;
	--v-button-color: #fff;
}
</style>

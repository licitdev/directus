<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import VButton from '@/components/v-button.vue';
import VChip from '@/components/v-chip.vue';

defineProps<{
	planName: string;
	planExpiryText: string;
	licenseStatus: string | null;
	canManageLicense: boolean;
	addLicenseKeyLabel: string;
	upgradePlanLabel: string;
	version: string;
	onOpenDrawer: () => void;
}>();

const { t } = useI18n();
</script>

<template>
	<div class="plan-section">
		<div class="plan-content">
			<div class="plan-info">
				<h2 class="plan-name">{{ planName }}</h2>
				<div class="plan-subtitle">
					<VChip class="current-plan-chip" small>{{ t('settings_license_current_plan') }}</VChip>
					<VChip v-if="licenseStatus === 'expired'" class="expired-plan-chip" small>
						{{ t('license_status_expired') }}
					</VChip>
					<span class="plan-subtitle-sep">•</span>
					<span class="plan-subtitle-expiry">{{ planExpiryText }}</span>
				</div>
			</div>
			<div class="plan-actions">
				<VButton :disabled="!canManageLicense" secondary small class="plan-action-btn" @click="onOpenDrawer">
					{{ addLicenseKeyLabel }}
				</VButton>
				<VButton
					small
					class="plan-action-btn"
					:href="`https://directus.io/license-request?utm_source=self_hosted&utm_medium=product&utm_campaign=2025_10_kyc&utm_term=${version}&utm_content=settings_upgrade`"
					target="_blank"
				>
					{{ upgradePlanLabel }}
				</VButton>
			</div>
		</div>
		<div class="plan-separator" />
	</div>
</template>

<style scoped>
.plan-section {
	--plan-actions-extend: 150px;
	position: relative;
	padding-block-end: 15px;
	inline-size: 100%;
	box-sizing: border-box;
}

.plan-content {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 24px;
}

.plan-separator {
	position: absolute;
	inset-inline: 0 calc(-1 * var(--plan-actions-extend, 150px));
	inset-block-end: 0;
	block-size: 1px;
	background: var(--theme--border-color);
}

.plan-info {
	flex: 1;
	min-inline-size: 0;
}

.plan-actions {
	display: flex;
	gap: 12px;
	flex-shrink: 0;
	margin-inline: auto calc(-1 * var(--plan-actions-extend, 150px));
}

.plan-action-btn {
	white-space: nowrap;
}

.plan-name {
	font-size: 25px;
	font-weight: 600;
	color: var(--theme--foreground-accent);
	margin: 0 0 8px;
}

.plan-subtitle {
	display: flex;
	align-items: center;
	gap: 8px;
	font-size: 14px;
	color: var(--theme--foreground-subdued);
	margin: 0;
}

.plan-subtitle :deep(.current-plan-chip) {
	--v-chip-color: var(--theme--primary);
	--v-chip-background-color: var(--theme--primary-background);
	--v-chip-border-color: var(--theme--primary-background);
	border-radius: 9999px !important;
}

.plan-subtitle :deep(.expired-plan-chip) {
	--v-chip-color: var(--theme--danger);
	--v-chip-background-color: var(--theme--background-danger);
	--v-chip-border-color: var(--theme--background-danger);
	border-radius: 9999px !important;
}

.plan-subtitle-sep {
	color: var(--theme--foreground-subdued);
}

.plan-subtitle-expiry {
	color: var(--theme--foreground-subdued);
}
</style>

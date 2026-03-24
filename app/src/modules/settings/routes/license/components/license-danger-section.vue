<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import VButton from '@/components/v-button.vue';
import VIcon from '@/components/v-icon/v-icon.vue';
import VNotice from '@/components/v-notice.vue';

defineProps<{
	deactivating: boolean;
	onConfirmDeactivate: () => void;
	isLicenseFromEnv: boolean;
}>();

const { t } = useI18n();
</script>

<template>
	<div class="danger-zone-section">
		<div class="danger-zone-header">
			<VIcon name="emergency_home" class="danger-zone-icon" />
			<h3 class="danger-zone-title">{{ t('settings_license_danger_zone') }}</h3>
		</div>

		<div class="danger-zone-separator" />

		<div v-if="isLicenseFromEnv" class="danger-zone-banner">
			<VNotice type="info">{{ t('settings_license_env_managed') }}</VNotice>
		</div>

		<div class="danger-zone-content">
			<VButton
				kind="danger"
				:loading="deactivating"
				:disabled="isLicenseFromEnv || deactivating"
				@click="onConfirmDeactivate"
			>
				{{ t('settings_license_deactivate') }}
			</VButton>
		</div>
	</div>
</template>

<style scoped>
.danger-zone-section {
	margin-block-start: 48px;
}

.danger-zone-header {
	display: flex;
	align-items: center;
	gap: 12px;
	margin-block-end: 0;
}

.danger-zone-icon {
	--v-icon-color: var(--theme--danger);
	--v-icon-size: 28px;
	flex-shrink: 0;
}

.danger-zone-title {
	font-size: 25px;
	font-weight: 600;
	color: var(--theme--foreground);
	margin: 0;
}

.danger-zone-separator {
	block-size: 1px;
	background: var(--theme--border-color);
	margin-block: 16px 20px;
}

.danger-zone-content {
	display: grid;
	gap: 16px;
}

.danger-zone-banner {
	margin-block: 2.25rem;
}
</style>

<script setup lang="ts">
import { I18nT, useI18n } from 'vue-i18n';
import VIcon from '@/components/v-icon/v-icon.vue';
import VNotice from '@/components/v-notice.vue';

defineProps<{
	showExpiringSoonWarning: boolean;
	showGracePeriodWarning: boolean;
	showExpiredBeyondGraceNotice: boolean;
	licenseSource: string | null;
	daysUntilExpiry: number;
	remainingGraceDays: number;
}>();

const { t } = useI18n();
</script>

<template>
	<div class="banners-section">
		<div v-if="showExpiringSoonWarning" class="license-grace-period-banner license-expiring-soon-banner">
			<div class="banner-accent" />
			<div class="banner-content">
				<div class="banner-icon-wrapper">
					<VIcon name="warning" class="banner-icon" />
				</div>
				<span class="banner-text">
					<I18nT keypath="license_expiring_soon_warning" tag="span">
						<template #days>
							<strong>{{ daysUntilExpiry }} {{ daysUntilExpiry === 1 ? 'day' : 'days' }}</strong>
						</template>
					</I18nT>
				</span>
			</div>
		</div>

		<div v-else-if="showGracePeriodWarning" class="license-grace-period-banner">
			<div class="banner-accent" />
			<div class="banner-content">
				<div class="banner-icon-wrapper">
					<VIcon name="dangerous" class="banner-icon" />
				</div>
				<span class="banner-text">
					<I18nT keypath="license_grace_period_warning" tag="span">
						<template #days>
							<strong>{{ remainingGraceDays }} {{ remainingGraceDays === 1 ? 'day' : 'days' }}</strong>
						</template>
					</I18nT>
				</span>
			</div>
		</div>

		<div v-else-if="showExpiredBeyondGraceNotice" class="license-grace-period-banner">
			<div class="banner-accent" />
			<div class="banner-content">
				<div class="banner-icon-wrapper">
					<VIcon name="dangerous" class="banner-icon" />
				</div>
				<span class="banner-text">{{ t('license_project_locked_notice') }}</span>
			</div>
		</div>

		<div v-if="licenseSource === 'env'" class="env-managed-banner">
			<VNotice type="info">{{ t('settings_license_env_managed') }}</VNotice>
		</div>
	</div>
</template>

<style scoped>
.banners-section {
	--banners-extend: 150px;
	display: flex;
	flex-direction: column;
	gap: 0;
	margin-inline-end: calc(-1 * var(--banners-extend, 150px));
	inline-size: calc(100% + var(--banners-extend, 150px));
	min-inline-size: 100%;
}

.license-grace-period-banner {
	display: flex;
	align-items: stretch;
	inline-size: 100%;
	background: var(--theme--background-subdued);
	border-radius: var(--theme--border-radius);
	overflow: hidden;
	margin-block-end: 24px;
}

.license-grace-period-banner .banner-accent {
	inline-size: 6px;
	flex-shrink: 0;
	background: var(--theme--danger);
	border-radius: var(--theme--border-radius) 0 0 var(--theme--border-radius);
}

.license-expiring-soon-banner .banner-accent {
	background: var(--theme--warning);
}

.license-expiring-soon-banner .banner-icon {
	--v-icon-color: var(--theme--warning);
}

.license-grace-period-banner .banner-content {
	display: flex;
	align-items: center;
	gap: 16px;
	padding: 16px 20px;
	flex: 1;
}

.license-grace-period-banner .banner-icon-wrapper {
	display: flex;
	align-items: center;
	justify-content: center;
	inline-size: 24px;
	block-size: 24px;
	flex-shrink: 0;
}

.license-grace-period-banner .banner-icon {
	--v-icon-color: var(--theme--danger);
	--v-icon-size: 24px;
}

.license-grace-period-banner .banner-text {
	font-size: 14px;
	line-height: 22px;
	color: var(--theme--foreground);
}

.license-grace-period-banner .banner-text strong {
	font-weight: 600;
}

.env-managed-banner {
	inline-size: 100%;
	margin-block-end: 24px;
}
</style>

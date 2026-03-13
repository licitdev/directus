<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import VIcon from '@/components/v-icon/v-icon.vue';

defineProps<{
	collectionsCount: number;
	collectionsLimit: number;
	usersCount: number;
	usersLimit: number;
	customRulesAvailable: boolean;
	customLlmAvailable: boolean;
	ssoAvailable: boolean;
}>();

const { t } = useI18n();
</script>

<template>
	<div class="plan-usage-section">
		<h3 class="section-title">
			{{ t('settings_license_your_plan_usage') }}
		</h3>
		<div class="usage-grid">
			<div class="usage-item">
				<VIcon name="database" class="usage-icon" />
				<span class="usage-label">{{ t('settings_license_usage_collections') }}</span>
				<span class="usage-value">{{ collectionsCount }} / {{ collectionsLimit || '∞' }}</span>
			</div>
			<div class="usage-item">
				<VIcon name="admin_panel_settings" class="usage-icon" />
				<span class="usage-label">{{ t('settings_license_usage_custom_rules') }}</span>
				<span :class="['usage-badge', customRulesAvailable ? 'badge-available' : 'badge-unavailable']">
					{{ customRulesAvailable ? t('settings_license_usage_available') : t('settings_license_usage_unavailable') }}
				</span>
			</div>
			<div class="usage-item">
				<VIcon name="group" class="usage-icon" />
				<span class="usage-label">{{ t('settings_license_usage_seats') }}</span>
				<span class="usage-value">{{ usersCount }} / {{ usersLimit || '∞' }}</span>
			</div>
			<div class="usage-item">
				<VIcon name="smart_toy" class="usage-icon" />
				<span class="usage-label">{{ t('settings_license_usage_custom_llm') }}</span>
				<span :class="['usage-badge', customLlmAvailable ? 'badge-available' : 'badge-unavailable']">
					{{ customLlmAvailable ? t('settings_license_usage_available') : t('settings_license_usage_unavailable') }}
				</span>
			</div>
			<div class="usage-item">
				<VIcon name="cloud_lock" class="usage-icon" />
				<span class="usage-label">{{ t('settings_license_usage_sso') }}</span>
				<span :class="['usage-badge', ssoAvailable ? 'badge-available' : 'badge-unavailable']">
					{{ ssoAvailable ? t('settings_license_usage_available') : t('settings_license_usage_unavailable') }}
				</span>
			</div>
			<div class="usage-item">
				<VIcon name="bar_chart" class="usage-icon" />
				<span class="usage-label">{{ t('settings_license_usage_analytics') }}</span>
				<span class="usage-badge badge-unavailable">
					{{ t('settings_license_usage_opt_in') }}
				</span>
			</div>
		</div>
	</div>
</template>

<style scoped>
.plan-usage-section {
	margin-block-end: 32px;
}

.section-title {
	display: flex;
	align-items: center;
	gap: 8px;
	font-size: 14px;
	font-weight: 600;
	color: var(--theme--foreground);
	margin: 0 0 16px;
}

.usage-grid {
	display: grid;
	grid-template-columns: repeat(2, 1fr);
	gap: 12px;
}

.usage-item {
	display: flex;
	align-items: center;
	gap: 10px;
	padding: 10px 12px;
	background: var(--theme--background-subdued);
	border-radius: 10px;
}

.usage-icon {
	--v-icon-color: var(--theme--foreground-subdued);
	--v-icon-size: 20px;
	flex-shrink: 0;
}

.usage-label {
	font-size: 13px;
	color: var(--theme--foreground);
	flex: 1;
	min-inline-size: 0;
}

.usage-value {
	font-size: 13px;
	font-weight: 500;
	color: var(--theme--foreground-accent);
	flex-shrink: 0;
}

.usage-badge {
	font-size: 12px;
	font-weight: 500;
	padding: 2px 8px;
	border-radius: 8px;
	flex-shrink: 0;
}

.badge-available {
	background: var(--theme--background-success);
	color: var(--theme--foreground-success);
}

.badge-unavailable {
	background: var(--theme--background-subdued);
	color: var(--theme--foreground-subdued);
}
</style>

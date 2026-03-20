<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import VChip from '@/components/v-chip.vue';
import VIcon from '@/components/v-icon/v-icon.vue';

const props = withDefaults(
	defineProps<{
		collectionsCount: number;
		collectionsLimit: number;
		usersCount: number;
		usersLimit: number;
		customRulesAvailable: boolean;
		customLlmAvailable: boolean;
		ssoAvailable: boolean;
		labelIncluded?: string;
		labelNotIncluded?: string;
		labelOptional?: string;
	}>(),
	{
		labelIncluded: undefined,
		labelNotIncluded: undefined,
		labelOptional: undefined,
	},
);

const { t } = useI18n();

const displayLabelIncluded = computed(() => props.labelIncluded ?? t('settings_license_usage_available'));

const displayLabelNotIncluded = computed(() => props.labelNotIncluded ?? t('settings_license_usage_unavailable'));

const displayLabelOptional = computed(() => props.labelOptional ?? t('settings_license_usage_opt_in'));
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
				<span :class="customRulesAvailable ? 'badge-available' : 'badge-unavailable'">
					<VChip small>
						{{ customRulesAvailable ? displayLabelIncluded : displayLabelNotIncluded }}
					</VChip>
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
				<span :class="customLlmAvailable ? 'badge-available' : 'badge-unavailable'">
					<VChip small>
						{{ customLlmAvailable ? displayLabelIncluded : displayLabelNotIncluded }}
					</VChip>
				</span>
			</div>
			<div class="usage-item">
				<VIcon name="cloud_lock" class="usage-icon" />
				<span class="usage-label">{{ t('settings_license_usage_sso') }}</span>
				<span :class="ssoAvailable ? 'badge-available' : 'badge-unavailable'">
					<VChip small>
						{{ ssoAvailable ? displayLabelIncluded : displayLabelNotIncluded }}
					</VChip>
				</span>
			</div>
			<div class="usage-item">
				<VIcon name="bar_chart" class="usage-icon" />
				<span class="usage-label">{{ t('settings_license_usage_analytics') }}</span>
				<span class="badge-unavailable">
					<VChip small>{{ displayLabelOptional }}</VChip>
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

.badge-available,
.badge-unavailable {
	display: inline-flex;
	flex-shrink: 0;
}

.badge-available {
	--v-chip-color: var(--theme--success);
	--v-chip-background-color: var(--theme--success-background);
	--v-chip-border-color: var(--theme--success-background);
}

.badge-unavailable {
	--v-chip-color: var(--theme--foreground-subdued);
	--v-chip-background-color: var(--theme--background-subdued);
	--v-chip-border-color: var(--theme--background-subdued);
}
</style>

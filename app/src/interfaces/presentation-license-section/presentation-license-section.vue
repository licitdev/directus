<script setup lang="ts">
import { inject } from 'vue';
import LicenseAddonsSection from '@/modules/settings/routes/license/components/license-addons-section.vue';
import LicenseBannersSection from '@/modules/settings/routes/license/components/license-banners-section.vue';
import LicenseDangerSection from '@/modules/settings/routes/license/components/license-danger-section.vue';
import LicensePlanSection from '@/modules/settings/routes/license/components/license-plan-section.vue';
import LicenseUsageSection from '@/modules/settings/routes/license/components/license-usage-section.vue';

withDefaults(
	defineProps<{
		section?: 'plan' | 'banners' | 'usage' | 'addons' | 'danger';
		value?: Record<string, any>;
	}>(),
	{
		section: 'plan',
		value: () => ({}),
	},
);

const openDrawer = inject<() => void>('license:openDrawer', () => {});
const onConfirmDeactivate = inject<() => void>('license:onConfirmDeactivate', () => {});
</script>

<template>
	<div class="presentation-license-section">
		<LicensePlanSection
			v-if="section === 'plan' && value"
			:plan-name="value.planName ?? ''"
			:plan-expiry-text="value.planExpiryText ?? ''"
			:license-status="value.licenseStatus ?? null"
			:can-manage-license="value.canManageLicense ?? false"
			:add-license-key-label="value.addLicenseKeyLabel ?? ''"
			:upgrade-plan-label="value.upgradePlanLabel ?? ''"
			:version="value.version ?? ''"
			:on-open-drawer="openDrawer"
		/>
		<LicenseBannersSection
			v-else-if="section === 'banners' && value"
			:show-expiring-soon-warning="value.showExpiringSoonWarning ?? false"
			:show-grace-period-warning="value.showGracePeriodWarning ?? false"
			:show-expired-beyond-grace-notice="value.showExpiredBeyondGraceNotice ?? false"
			:license-source="value.licenseSource ?? null"
			:days-until-expiry="value.daysUntilExpiry ?? 0"
			:remaining-grace-days="value.remainingGraceDays ?? 0"
		/>
		<LicenseUsageSection
			v-else-if="section === 'usage' && value"
			:collections-count="value.collectionsCount ?? 0"
			:collections-limit="value.collectionsLimit ?? 0"
			:users-count="value.usersCount ?? 0"
			:users-limit="value.usersLimit ?? 0"
			:custom-rules-available="value.customRulesAvailable ?? false"
			:custom-llm-available="value.customLlmAvailable ?? false"
			:sso-available="value.ssoAvailable ?? false"
			:label-included="value.labelIncluded"
			:label-not-included="value.labelNotIncluded"
			:label-optional="value.labelOptional"
		/>
		<LicenseAddonsSection
			v-else-if="section === 'addons' && value"
			:addons="value.addons ?? []"
			:addons-loading="value.addonsLoading ?? false"
			:addons-error="value.addonsError ?? null"
			:version="value.version ?? ''"
		/>
		<LicenseDangerSection
			v-else-if="section === 'danger' && value"
			:deactivating="value.deactivating ?? false"
			:on-confirm-deactivate="onConfirmDeactivate"
			:is-license-from-env="value.isLicenseFromEnv ?? false"
		/>
	</div>
</template>

<style scoped>
.presentation-license-section {
	inline-size: 100%;
}
</style>

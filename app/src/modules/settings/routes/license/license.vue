<script setup lang="ts">
import { watchDebounced } from '@vueuse/core';
import { storeToRefs } from 'pinia';
import { computed, ref, watch } from 'vue';
import { I18nT, useI18n } from 'vue-i18n';
import SettingsNavigation from '../../components/navigation.vue';
import VBreadcrumb from '@/components/v-breadcrumb.vue';
import VButton from '@/components/v-button.vue';
import VChip from '@/components/v-chip.vue';
import VDrawer from '@/components/v-drawer.vue';
import VIcon from '@/components/v-icon/v-icon.vue';
import VNotice from '@/components/v-notice.vue';
import VProgressCircular from '@/components/v-progress-circular.vue';
import { useLicensePreview } from '@/composables/use-license-preview';
import InterfaceInputHash from '@/interfaces/input-hash/input-hash.vue';
import DeactivationPopup from '@/modules/settings/routes/license/components/deactivation-popup.vue';
import { useServerStore } from '@/stores/server';
import { useSettingsStore } from '@/stores/settings';
import { PrivateView } from '@/views/private';

const { t } = useI18n();
const serverStore = useServerStore();
const settingsStore = useSettingsStore();
const { info, license, addons } = storeToRefs(serverStore);

const drawerOpen = ref(false);
const saving = ref(false);
const savedSuccessfully = ref(false);
const saveError = ref<string | null>(null);
const deactivating = ref(false);
const confirmDeactivate = ref(false);
const addonsLoading = ref(true);
const addonsError = ref<string | null>(null);

const hasLicense = computed(() => info.value.license != null);

const initialFormValues = ref<{ license_key: string | null }>({ license_key: null });
const formEdits = ref<{ license_key?: string | null } | null>(null);

const { previewPayload, validating, validationError, fetchPreview, clearPreview } = useLicensePreview();

const licenseSource = computed(() => info.value.license_source ?? null);

const planName = computed(
	() => (info.value.license?.metadata?.policy?.name as string | undefined) ?? t('settings_license_tier'),
);

const licenseExpiry = computed(() => {
	const expiry = info.value.license?.metadata?.license?.expiry as string | undefined;
	return expiry ? new Date(expiry) : null;
});

const planExpiryText = computed(() => {
	if (!licenseExpiry.value) return t('settings_license_never_expires');
	const isExpired = licenseExpiry.value.getTime() < Date.now();
	return isExpired
		? t('license_expired_on', { date: licenseExpiry.value.toLocaleDateString() })
		: t('license_expires_on', { date: licenseExpiry.value.toLocaleDateString() });
});

const licenseStatus = computed(() => {
	const status = (info.value.license?.metadata?.license?.status as string | undefined)?.toUpperCase();
	const expiry = info.value.license?.metadata?.license?.expiry as string | undefined;
	const isPastExpiry = expiry ? new Date(expiry).getTime() < Date.now() : false;

	if (!status) return null;
	if (status === 'EXPIRED' || isPastExpiry) return 'expired';
	if (status === 'EXPIRING') return 'expiring';
	if (status === 'ACTIVE') return 'active';
	return null;
});

const licenseGracePeriodMs = computed(() => {
	return (info.value.license?.metadata?.license?.grace_period as number) ?? 7 * 24 * 60 * 60 * 1000;
});

const remainingGraceDays = computed(() => {
	if (!licenseExpiry.value) return 0;
	const expiryTime = licenseExpiry.value.getTime();
	const now = Date.now();
	if (now <= expiryTime) return 0;
	const graceEnd = expiryTime + licenseGracePeriodMs.value;
	if (now >= graceEnd) return 0;
	return Math.ceil((graceEnd - now) / (24 * 60 * 60 * 1000));
});

const daysUntilExpiry = computed(() => {
	if (!licenseExpiry.value) return 0;
	const expiryTime = licenseExpiry.value.getTime();
	const now = Date.now();
	if (now >= expiryTime) return 0;
	return Math.ceil((expiryTime - now) / (24 * 60 * 60 * 1000));
});

const showExpiringSoonWarning = computed(
	() =>
		hasLicense.value &&
		licenseStatus.value !== 'expired' &&
		daysUntilExpiry.value > 0 &&
		daysUntilExpiry.value <= 7 &&
		!info.value.license_locked,
);

const showGracePeriodWarning = computed(
	() => licenseStatus.value === 'expired' && remainingGraceDays.value > 0 && !info.value.license_locked,
);

const showExpiredBeyondGraceNotice = computed(
	() => licenseStatus.value === 'expired' && remainingGraceDays.value === 0 && !info.value.license_locked,
);

const drawerPayload = computed(() => (savedSuccessfully.value ? info.value.license : null));

const showDeactivateSection = computed(() => licenseSource.value === 'settings' && info.value.license != null);

const canManageLicense = computed(() => licenseSource.value !== 'env');

const addLicenseKeyLabel = computed(() =>
	hasLicense.value ? t('settings_license_manage') : t('settings_license_add'),
);

const upgradePlanLabel = computed(() =>
	hasLicense.value ? t('settings_license_manage_plan') : t('settings_license_upgrade_plan'),
);

const collectionsLimit = computed(() => license.value?.entitlements?.collections?.limit ?? 0);
const collectionsUsage = computed(() => license.value?.entitlements?.collections?.usage ?? 0);

const usersRemainingSeats = computed(() => license.value?.entitlements?.users?.remaining_seats ?? 0);
const usersUsage = computed(() => license.value?.entitlements?.users?.usage ?? 0);

const ssoEnabled = computed(() => license.value?.entitlements?.sso?.enabled ?? false);
const customPermissionsEnabled = computed(() => license.value?.entitlements?.custom_permissions?.enabled ?? false);

const activePayload = computed(() => drawerPayload.value ?? previewPayload.value);
const expiryFormatted = computed(() => activePayload.value?.expiry?.slice?.(0, 10) ?? null);
const tierNameFromPayload = computed(() => activePayload.value?.policy ?? null);
const customerName = computed(() => activePayload.value?.customer ?? null);
const showValidationStatus = computed(() => Boolean(activePayload.value?.valid));

const currentLicenseKey = computed(() => {
	const edits = formEdits.value;
	return (edits?.license_key ?? initialFormValues.value.license_key)?.trim() || null;
});

const canSaveLicenseKey = computed(() => {
	const hasKey = Boolean(currentLicenseKey.value);
	const isValid = Boolean(activePayload.value?.valid);
	const notValidating = !validating.value;
	const noError = !validationError.value;
	return hasKey && isValid && notValidating && noError;
});

watch(currentLicenseKey, (val) => {
	if (!val) clearPreview();
});

watchDebounced(
	currentLicenseKey,
	async (val) => {
		if (val) await fetchPreview(val);
		else clearPreview();
	},
	{ debounce: 400 },
);

function openDrawer() {
	initialFormValues.value = { license_key: null };
	formEdits.value = null;
	savedSuccessfully.value = false;
	saveError.value = null;
	clearPreview();
	drawerOpen.value = true;
}

async function saveLicenseKey() {
	const key = currentLicenseKey.value;
	saveError.value = null;
	saving.value = true;

	try {
		await settingsStore.updateSettings({ license_key: key || null });
		await serverStore.hydrate();
		closeDrawer();
	} catch (err: any) {
		saveError.value = err?.response?.data?.errors?.[0]?.message ?? err?.message ?? t('unexpected_error');
	} finally {
		saving.value = false;
	}
}

watch(formEdits, (edits) => {
	if (edits && Object.keys(edits).length > 0) {
		savedSuccessfully.value = false;
		saveError.value = null;
	}
});

function closeDrawer() {
	drawerOpen.value = false;
	formEdits.value = null;
	initialFormValues.value = { license_key: null };
	savedSuccessfully.value = false;
	saveError.value = null;
	clearPreview();
}

function onLicenseKeyInput(v: string) {
	formEdits.value = {
		license_key: v === '' ? null : v,
	};
}

const ADDON_ICON_MAP: Record<string, string> = {
	sso: 'cloud_lock',
	user_seats: 'group',
	collections: 'inventory_2',
};

function mapAddonToDisplay(item: { id: string; name: string; description: string; status: string; action: string }) {
	return {
		...item,
		icon: ADDON_ICON_MAP[item.id] ?? 'extension',
		showPurchase: item.action === 'purchase',
		showInfo: item.action === 'info',
	};
}
</script>

<template>
	<PrivateView :title="t('settings_license')" icon="diamond">
		<template #headline>
			<VBreadcrumb :items="[{ name: t('settings'), to: '/settings' }]" />
		</template>

		<template #navigation>
			<SettingsNavigation />
		</template>

		<div class="license-page-wrapper">
			<div class="plan-section">
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
					<VButton v-if="canManageLicense" secondary small class="plan-action-btn" @click="openDrawer">
						{{ addLicenseKeyLabel }}
					</VButton>
					<VButton
						small
						class="plan-action-btn"
						:href="`https://directus.io/license-request?utm_source=self_hosted&utm_medium=product&utm_campaign=2025_10_kyc&utm_term=${info.version}&utm_content=settings_upgrade`"
						target="_blank"
					>
						{{ upgradePlanLabel }}
					</VButton>
				</div>
			</div>

			<div class="license-page">
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

				<div class="plan-usage-section">
					<h3 class="section-title">
						{{ t('settings_license_your_plan_usage') }}
					</h3>
					<div class="usage-grid">
						<div class="usage-item">
							<VIcon name="database" class="usage-icon" />
							<span class="usage-label">{{ t('settings_license_usage_collections') }}</span>
							<span class="usage-value">{{ collectionsUsage }} / {{ collectionsLimit || '∞' }}</span>
						</div>
						<div class="usage-item">
							<VIcon name="admin_panel_settings" class="usage-icon" />
							<span class="usage-label">{{ t('settings_license_usage_custom_rules') }}</span>
							<span :class="['usage-badge', customPermissionsEnabled ? 'badge-available' : 'badge-unavailable']">
								{{
									customPermissionsEnabled
										? t('settings_license_usage_available')
										: t('settings_license_usage_unavailable')
								}}
							</span>
						</div>
						<div class="usage-item">
							<VIcon name="group" class="usage-icon" />
							<span class="usage-label">{{ t('settings_license_usage_seats') }}</span>
							<span class="usage-value">{{ usersUsage }} / {{ usersUsage + usersRemainingSeats || '∞' }}</span>
						</div>
						<div class="usage-item">
							<VIcon name="cloud_lock" class="usage-icon" />
							<span class="usage-label">{{ t('settings_license_usage_sso') }}</span>
							<span :class="['usage-badge', ssoEnabled ? 'badge-available' : 'badge-unavailable']">
								{{ ssoEnabled ? t('settings_license_usage_available') : t('settings_license_usage_unavailable') }}
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

				<div class="add-on-section">
					<h3 class="section-title">
						<VIcon name="diamond" class="section-icon" />
						{{ t('settings_license_add_on_packages') }}
					</h3>
					<div class="add-on-grid">
						<div v-if="addonsLoading" class="add-on-loading">
							<VProgressCircular indeterminate small />
							<span>{{ t('loading') }}</span>
						</div>
						<VNotice v-else-if="addonsError" type="danger" class="add-on-error">
							{{ addonsError }}
						</VNotice>
						<template v-else>
							<div v-for="pkg in addons.data.map(mapAddonToDisplay)" :key="pkg.id" class="add-on-card">
								<div class="add-on-icon-wrapper">
									<VIcon :name="pkg.icon" class="add-on-icon" />
								</div>
								<div class="add-on-content">
									<span class="add-on-title">{{ pkg.name }}</span>
									<span class="add-on-description">{{ pkg.description }}</span>
								</div>
								<VButton
									v-if="pkg.showPurchase"
									secondary
									small
									class="add-on-purchase-btn"
									:href="`https://directus.io/license-request?utm_source=self_hosted&utm_medium=product&utm_campaign=2025_10_kyc&utm_term=${info.version}&utm_content=settings_addon_${pkg.id}`"
									target="_blank"
								>
									{{ t('settings_license_purchase') }}
								</VButton>
								<VIcon
									v-else-if="pkg.showInfo"
									v-tooltip.bottom="t('settings_license_add_on_info')"
									name="info"
									class="add-on-info-icon"
								/>
							</div>
						</template>
					</div>
				</div>

				<div v-if="showDeactivateSection" class="danger-zone-section">
					<div class="danger-zone-header">
						<VIcon name="emergency_home" class="danger-zone-icon" />
						<h3 class="danger-zone-title">{{ t('settings_license_danger_zone') }}</h3>
					</div>
					<div class="danger-zone-separator" />
					<div class="danger-zone-content">
						<VButton kind="danger" :loading="deactivating" :disabled="deactivating" @click="confirmDeactivate = true">
							{{ t('settings_license_deactivate') }}
						</VButton>
					</div>
				</div>
			</div>
		</div>

		<DeactivationPopup v-model:open="confirmDeactivate" />

		<VDrawer
			v-if="canManageLicense"
			v-model="drawerOpen"
			:title="t('license_key_management')"
			icon="vpn_key"
			@cancel="closeDrawer"
		>
			<template #actions>
				<div class="license-save-button" :class="{ 'is-enabled': canSaveLicenseKey }">
					<VButton
						v-tooltip.bottom="t('save')"
						secondary
						small
						:disabled="!canSaveLicenseKey"
						:loading="saving"
						@click="saveLicenseKey"
					>
						{{ t('save') }}
					</VButton>
				</div>
			</template>

			<div class="drawer-content">
				<VNotice v-if="saveError" type="danger" class="save-error">
					{{ saveError }}
				</VNotice>

				<VNotice type="info" class="drawer-info-banner">
					<span>{{ t('license_key_management_notice') }}</span>
					<br />
					<I18nT keypath="settings_license_business_plan_notice" tag="span">
						<template #learnMore>
							<a
								:href="`https://directus.io/license-request?utm_source=self_hosted&utm_medium=product&utm_campaign=2025_10_kyc&utm_term=${info.version}&utm_content=settings_learn_more`"
								target="_blank"
							>
								{{ t('settings_license_learn_more') }}
							</a>
						</template>
					</I18nT>
				</VNotice>

				<div class="license-key-field">
					<label class="license-key-label">{{ t('license_key') }}</label>
					<InterfaceInputHash
						:value="
							hasLicense && !formEdits?.license_key
								? ' '
								: (formEdits?.license_key ?? initialFormValues.license_key ?? null)
						"
						:placeholder="t('license_key_placeholder')"
						masked
						autocomplete="off"
						@input="onLicenseKeyInput"
					/>
				</div>

				<div v-if="validating" class="validation-status">
					<span class="status-item">
						<VProgressCircular class="spinner-inline" small indeterminate />
						{{ t('loading') }}
					</span>
				</div>

				<div v-else-if="validationError" class="validation-status">
					<span class="status-item status-invalid">
						<VIcon name="cancel" class="status-icon status-icon--error" />
						{{ validationError || t('license_invalid') }}
					</span>
				</div>

				<div v-else-if="showValidationStatus" class="validation-status">
					<span class="status-item">
						<VIcon name="check_circle" class="status-icon" />
						{{ t('license_valid') }}
					</span>
					<span v-if="tierNameFromPayload" class="status-item">
						<VIcon name="check_circle" class="status-icon" />
						{{ tierNameFromPayload }}
					</span>
					<span v-if="expiryFormatted" class="status-item">
						<VIcon name="check_circle" class="status-icon" />
						{{ t('license_expires_on', { date: expiryFormatted }) }}
					</span>
					<span v-if="customerName" class="status-item">
						<VIcon name="check_circle" class="status-icon" />
						{{ t('settings_license_customer') }}: {{ customerName }}
					</span>
				</div>
			</div>
		</VDrawer>
	</PrivateView>
</template>

<style scoped>
.license-page-wrapper {
	inline-size: 100%;
}

.plan-section {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 24px;
	padding-inline: var(--content-padding);
	padding-block: var(--content-padding) 0;
	margin-block-end: 32px;
	inline-size: 100%;
	box-sizing: border-box;
}

.license-page {
	padding: var(--content-padding);
	padding-block-end: var(--content-padding-bottom);
	max-inline-size: 1000px;
}

.plan-info {
	flex: 1;
	min-inline-size: 0;
}

.plan-actions {
	display: flex;
	gap: 12px;
	flex-shrink: 0;
}

.plan-action-btn {
	white-space: nowrap;
}

.plan-name {
	font-size: 20px;
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

.section-title {
	display: flex;
	align-items: center;
	gap: 8px;
	font-size: 14px;
	font-weight: 600;
	color: var(--theme--foreground);
	margin: 0 0 16px;
}

.section-icon {
	--v-icon-color: var(--theme--primary);
}

.license-grace-period-banner {
	display: flex;
	align-items: stretch;
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
	margin-block-end: 24px;
}

.plan-usage-section {
	margin-block-end: 32px;
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

.add-on-section {
	margin-block-end: 32px;
}

.add-on-loading {
	display: flex;
	align-items: center;
	gap: 12px;
	padding: 16px 20px;
	color: var(--theme--foreground-subdued);
	font-size: 14px;
}

.add-on-error {
	margin-block-end: 0;
}

.add-on-grid {
	display: grid;
	grid-template-columns: 1fr;
	gap: 12px;
}

.add-on-card {
	display: flex;
	align-items: center;
	gap: 16px;
	padding: 16px 20px;
	background: var(--theme--background-subdued);
	border-radius: 8px;
}

.add-on-icon-wrapper {
	display: flex;
	align-items: center;
	justify-content: center;
	inline-size: 40px;
	block-size: 40px;
	border-radius: 50%;
	background: var(--theme--primary);
	flex-shrink: 0;
}

.add-on-icon {
	--v-icon-color: var(--white);
	--v-icon-size: 22px;
	flex-shrink: 0;
}

.add-on-info-icon {
	--v-icon-color: var(--theme--foreground-subdued);
	--v-icon-size: 18px;
	flex-shrink: 0;
}

.add-on-content {
	display: flex;
	flex-direction: column;
	gap: 4px;
	flex: 1;
	min-inline-size: 0;
}

.add-on-purchase-btn {
	white-space: nowrap;
	flex-shrink: 0;
}

.add-on-title {
	font-size: 14px;
	font-weight: 600;
	color: var(--theme--foreground);
}

.add-on-description {
	font-size: 13px;
	color: var(--theme--foreground-subdued);
}

.danger-zone-section {
	margin-block-start: 48px;
	padding-block-start: 24px;
}

.danger-zone-header {
	display: flex;
	align-items: center;
	gap: 8px;
	margin-block-end: 0;
}

.danger-zone-icon {
	--v-icon-color: var(--theme--danger);
	--v-icon-size: 20px;
	flex-shrink: 0;
}

.danger-zone-title {
	font-size: 14px;
	font-weight: 600;
	color: var(--theme--foreground);
	margin: 0;
}

.danger-zone-separator {
	block-size: 1px;
	background: var(--theme--border-color);
	margin-block: 12px 16px;
}

.danger-zone-content {
	padding-block-start: 16px;
	display: grid;
	gap: 12px;
}

.danger-zone-notice {
	font-size: 14px;
	color: var(--theme--foreground-subdued);
	margin: 0;
}

.drawer-content {
	padding: var(--content-padding);
	display: grid;
	gap: 24px;
}

.license-save-button.is-enabled :deep(.v-button .button:not(:disabled)) {
	--v-button-color: var(--white);
	--v-button-color-hover: var(--white);
	--v-button-color-active: var(--white);
	--v-button-background-color: var(--theme--primary);
	--v-button-background-color-hover: var(--theme--primary-accent);
	--v-button-background-color-active: var(--theme--primary);
}

.save-error {
	margin-block-end: 0;
}

.drawer-info-banner {
	margin-block-end: 0;
}

.drawer-info-row {
	display: flex;
	align-items: flex-start;
	gap: 12px;
	font-size: 14px;
	line-height: 22px;
	color: var(--theme--foreground);
}

.drawer-info-icon {
	--v-icon-color: var(--theme--primary);
	--v-icon-size: 20px;
	flex-shrink: 0;
	margin-block-start: 1px;
}

.drawer-info-banner a {
	color: var(--theme--primary);
	text-decoration: underline;
}

.license-key-field {
	display: grid;
	gap: 8px;
}

.license-key-label {
	font-size: 14px;
	font-weight: 600;
	color: var(--theme--foreground);
}

.spinner-inline {
	--v-progress-circular-color: var(--theme--foreground-subdued);
	display: inline-block;
	vertical-align: middle;
	margin-inline-end: 8px;
}

.validation-status {
	display: grid;
	grid-template-columns: 1fr 1fr;
	gap: 4px 16px;
	margin-block-start: 4px;
}

.status-item {
	display: flex;
	align-items: center;
	gap: 6px;
	font-size: 13px;
	color: var(--theme--success);
}

.status-invalid {
	color: var(--theme--danger);
}

.status-icon {
	--v-icon-size: 16px;
	--v-icon-color: var(--theme--success);
	flex-shrink: 0;
}

.status-icon--error {
	--v-icon-color: var(--theme--danger);
}

.confirm-message {
	font-size: 14px;
	color: var(--theme--foreground);
	margin: 0 0 16px;
	padding-inline: 20px;
}
</style>

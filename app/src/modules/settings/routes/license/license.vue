<script setup lang="ts">
import type { DeepPartial } from '@directus/types';
import type { Field } from '@directus/types';
import { watchDebounced } from '@vueuse/core';
import { storeToRefs } from 'pinia';
import { computed, onMounted, provide, ref, watch } from 'vue';
import { I18nT, useI18n } from 'vue-i18n';
import SettingsNavigation from '../../components/navigation.vue';
import api from '@/api';
import VBreadcrumb from '@/components/v-breadcrumb.vue';
import VButton from '@/components/v-button.vue';
import VCardActions from '@/components/v-card-actions.vue';
import VCardTitle from '@/components/v-card-title.vue';
import VCard from '@/components/v-card.vue';
import VDialog from '@/components/v-dialog.vue';
import VDrawer from '@/components/v-drawer.vue';
import VForm from '@/components/v-form/v-form.vue';
import VIcon from '@/components/v-icon/v-icon.vue';
import VNotice from '@/components/v-notice.vue';
import VProgressCircular from '@/components/v-progress-circular.vue';
import { useLicensePreview } from '@/composables/use-license-preview';
import InterfaceInputHash from '@/interfaces/input-hash/input-hash.vue';
import { useCollectionsStore } from '@/stores/collections';
import { useServerStore } from '@/stores/server';
import { useSettingsStore } from '@/stores/settings';
import { notify } from '@/utils/notify';
import { unexpectedError } from '@/utils/unexpected-error';
import { PrivateView } from '@/views/private';

const { t } = useI18n();
const serverStore = useServerStore();
const settingsStore = useSettingsStore();
const collectionsStore = useCollectionsStore();
const { info } = storeToRefs(serverStore);

const drawerOpen = ref(false);
const saving = ref(false);
const savedSuccessfully = ref(false);
const saveError = ref<string | null>(null);
const deactivating = ref(false);
const confirmDeactivate = ref(false);
const usersCount = ref(0);
const addonsLoading = ref(true);
const addonsError = ref<string | null>(null);

const addons = ref<
	Array<{
		id: string;
		name: string;
		description: string;
		status: string;
		action: string;
		icon: string;
		showPurchase: boolean;
		showInfo: boolean;
	}>
>([]);

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

const collectionsLimit = computed(
	() => serverStore.license.entitlements.collections?.limit ?? 0,
);

const usersLimit = computed(() => {
	const u = serverStore.license.entitlements.users;
	const usage = u?.usage ?? 0;
	const remaining = u?.remaining_seats ?? 0;

	return usage + remaining || 0;
});

const collectionsCount = computed(() => collectionsStore.databaseCollections.length);

const licenseMetadata = computed(() => info.value.license?.metadata as Record<string, any> | undefined);
const entitlements = computed(() => licenseMetadata.value?.entitlements ?? {});

const ssoAvailable = computed(() => {
	const sso = entitlements.value?.sso ?? entitlements.value?.find?.((e: any) => e?.name === 'sso');
	if (Array.isArray(entitlements.value) && sso) return true;
	if (sso?.enabled === true) return true;
	return false;
});

const customRulesAvailable = computed(() => {
	const policies =
		entitlements.value?.access_policies ?? entitlements.value?.find?.((e: any) => e?.name === 'access_policies');

	if (Array.isArray(entitlements.value) && policies) return true;
	if (policies) return true;
	return false;
});

const customLlmAvailable = computed(() => {
	const llm = entitlements.value?.custom_llm ?? entitlements.value?.find?.((e: any) => e?.name === 'custom_llm');
	if (Array.isArray(entitlements.value) && llm) return true;
	if (llm) return true;
	return false;
});

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

onMounted(async () => {
	await collectionsStore.hydrate();
	await fetchAddons();

	try {
		const res = await api.get('/users', {
			params: { limit: 1, aggregate: { count: 'id' } },
		});

		usersCount.value = res.data?.data?.[0]?.count?.id ?? 0;
	} catch {
		usersCount.value = 0;
	}
});

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

async function deactivateLicense() {
	deactivating.value = true;
	confirmDeactivate.value = false;

	try {
		await api.post('/server/deactivate-license');
		await Promise.all([serverStore.hydrate(), settingsStore.hydrate()]);
		notify({ title: t('settings_license_deactivate_success') });
	} catch (err: any) {
		unexpectedError(err);
	} finally {
		deactivating.value = false;
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

async function fetchAddons() {
	addonsLoading.value = true;

	addonsError.value = null;

	try {
		const res = await api.get<{
			addons: Array<{ id: string; name: string; description: string; status: string; action: string }>;
		}>('/server/license/addons');

		const rawAddons = res.data?.addons ?? [];
		addons.value = rawAddons.map(mapAddonToDisplay);
	} catch (err: any) {
		addonsError.value = err?.response?.data?.errors?.[0]?.message ?? err?.message ?? t('unexpected_error');
		addons.value = [];
	} finally {
		addonsLoading.value = false;
	}
}

provide('license:openDrawer', openDrawer);

provide('license:onConfirmDeactivate', () => {
	confirmDeactivate.value = true;
});

const licenseFormFields = computed<DeepPartial<Field>[]>(() => {
	const items: DeepPartial<Field>[] = [
		{
			field: 'license_plan_section',
			name: '',
			type: 'alias',
			meta: {
				interface: 'presentation-license-section',
				options: { section: 'plan' },
				width: 'full',
			},
		},
		{
			field: 'license_banners_section',
			name: '',
			type: 'alias',
			meta: {
				interface: 'presentation-license-section',
				options: { section: 'banners' },
				width: 'full',
			},
		},
		{
			field: 'license_usage_section',
			name: '',
			type: 'alias',
			meta: {
				interface: 'presentation-license-section',
				options: { section: 'usage' },
				width: 'full',
			},
		},
		{
			field: 'license_addons_section',
			name: '',
			type: 'alias',
			meta: {
				interface: 'presentation-license-section',
				options: { section: 'addons' },
				width: 'full',
			},
		},
	];

	if (showDeactivateSection.value) {
		items.push({
			field: 'license_danger_section',
			name: '',
			type: 'alias',
			meta: {
				interface: 'presentation-license-section',
				options: { section: 'danger' },
				width: 'full',
			},
		});
	}

	return items;
});

const licenseFormValues = computed(() => ({
	license_plan_section: {
		planName: planName.value,
		planExpiryText: planExpiryText.value,
		licenseStatus: licenseStatus.value,
		canManageLicense: canManageLicense.value,
		addLicenseKeyLabel: addLicenseKeyLabel.value,
		upgradePlanLabel: upgradePlanLabel.value,
		version: info.value.version ?? '',
	},
	license_banners_section: {
		showExpiringSoonWarning: showExpiringSoonWarning.value,
		showGracePeriodWarning: showGracePeriodWarning.value,
		showExpiredBeyondGraceNotice: showExpiredBeyondGraceNotice.value,
		licenseSource: licenseSource.value,
		daysUntilExpiry: daysUntilExpiry.value,
		remainingGraceDays: remainingGraceDays.value,
	},
	license_usage_section: {
		collectionsCount: collectionsCount.value,
		collectionsLimit: collectionsLimit.value,
		usersCount: usersCount.value,
		usersLimit: usersLimit.value,
		customRulesAvailable: customRulesAvailable.value,
		customLlmAvailable: customLlmAvailable.value,
		ssoAvailable: ssoAvailable.value,
	},
	license_addons_section: {
		addons: addons.value,
		addonsLoading: addonsLoading.value,
		addonsError: addonsError.value,
		version: info.value.version ?? '',
	},
	license_danger_section: {
		deactivating: deactivating.value,
	},
}));

const licenseFormEdits = ref<Record<string, any> | null>(null);
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
			<div class="license-form-plan-wrapper">
				<VForm
					v-model="licenseFormEdits"
					:initial-values="licenseFormValues"
					:fields="licenseFormFields as Field[]"
					primary-key="license"
					disabled-menu
				/>
			</div>
		</div>

		<VDialog v-model="confirmDeactivate" @esc="confirmDeactivate = false">
			<VCard>
				<VCardTitle>{{ t('settings_license_deactivate_confirm_title') }}</VCardTitle>
				<p class="confirm-message">{{ t('settings_license_deactivate_confirm') }}</p>
				<VCardActions>
					<VButton secondary @click="confirmDeactivate = false">
						{{ t('cancel') }}
					</VButton>
					<VButton kind="danger" :loading="deactivating" @click="deactivateLicense">
						{{ t('settings_license_deactivate') }}
					</VButton>
				</VCardActions>
			</VCard>
		</VDialog>

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

.license-form-plan-wrapper {
	--theme--form--row-gap: 24px;
	padding-inline: var(--content-padding);
	padding-block: var(--content-padding) var(--content-padding-bottom);
	max-inline-size: 1000px;
}

.license-form-plan-wrapper :deep(.v-form .field:first-child) {
	padding-inline: 0;
	padding-block: 0;
	margin-block-end: 0;
}

.license-form-plan-wrapper :deep(.v-form .field:not(:first-child)) {
	padding-inline: 0;
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

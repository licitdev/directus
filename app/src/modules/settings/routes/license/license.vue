<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import SettingsNavigation from '../../components/navigation.vue';
import VBreadcrumb from '@/components/v-breadcrumb.vue';
import VButton from '@/components/v-button.vue';
import VCardActions from '@/components/v-card-actions.vue';
import VCardTitle from '@/components/v-card-title.vue';
import VCard from '@/components/v-card.vue';
import VDialog from '@/components/v-dialog.vue';
import VDrawer from '@/components/v-drawer.vue';
import VIcon from '@/components/v-icon/v-icon.vue';
import VInput from '@/components/v-input.vue';
import VNotice from '@/components/v-notice.vue';
import LicenseKeyInput from '@/modules/licensing/components/license-key-input.vue';
import api from '@/api';
import { useServerStore } from '@/stores/server';
import { useSettingsStore } from '@/stores/settings';
import { notify } from '@/utils/notify';
import { unexpectedError } from '@/utils/unexpected-error';
import { PrivateView } from '@/views/private';

const { t } = useI18n();
const serverStore = useServerStore();
const settingsStore = useSettingsStore();
const { info } = storeToRefs(serverStore);

const drawerOpen = ref(false);
const editingKey = ref<string | null>(null);
const saving = ref(false);
const savedSuccessfully = ref(false);
const saveError = ref<string | null>(null);
const deactivating = ref(false);
const confirmDeactivate = ref(false);

const licenseSource = computed(() => info.value.license_source ?? null);

const tierName = computed(
	() => (info.value.license?.metadata?.policy?.name as string | undefined) ?? t('settings_license_tier'),
);

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

const licenseExpiry = computed(() => {
	const expiry = info.value.license?.metadata?.license?.expiry as string | undefined;
	return expiry ? new Date(expiry) : null;
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

const showGracePeriodWarning = computed(
	() => licenseStatus.value === 'expired' && remainingGraceDays.value > 0 && !info.value.license_locked,
);

const drawerPayload = computed(() => (savedSuccessfully.value ? info.value.license : null));

const showDeactivateSection = computed(() => licenseSource.value === 'settings' && info.value.license != null);

function openDrawer() {
	editingKey.value = null;
	savedSuccessfully.value = false;
	saveError.value = null;
	drawerOpen.value = true;
}

async function saveLicenseKey() {
	saveError.value = null;
	saving.value = true;

	try {
		await settingsStore.updateSettings({ license_key: editingKey.value || null });
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

watch(editingKey, () => {
	savedSuccessfully.value = false;
	saveError.value = null;
});

function closeDrawer() {
	drawerOpen.value = false;
	editingKey.value = null;
	savedSuccessfully.value = false;
	saveError.value = null;
}
</script>

<template>
	<PrivateView :title="t('settings_license')" icon="policy">
		<template #headline>
			<VBreadcrumb :items="[{ name: t('settings'), to: '/settings' }]" />
		</template>

		<template #navigation>
			<SettingsNavigation />
		</template>

		<div class="license-page">
			<div class="section-header">
				<div class="tier-info">
					<VIcon name="star" class="tier-icon" />
					<h2>{{ tierName }}</h2>
					<span v-if="licenseStatus" :class="['status-badge', `status-${licenseStatus}`]">
						{{ t(`license_status_${licenseStatus}`) }}
					</span>
				</div>
			</div>

			<div v-if="licenseExpiry" class="expiry-row">
				{{ t('license_expires_on', { date: licenseExpiry.toLocaleDateString() }) }}
			</div>

			<VNotice v-if="showGracePeriodWarning" type="danger" class="grace-period-warning">
				{{
					remainingGraceDays === 1
						? t('license_grace_period_warning_one_day')
						: t('license_grace_period_warning', { days: String(remainingGraceDays) })
				}}
			</VNotice>

			<div class="license-key-section">
				<h3>{{ t('license_key') }}</h3>

				<template v-if="licenseSource === 'env'">
					<div class="license-key-row">
						<VInput :model-value="t('settings_license_value_stored')" readonly class="license-key-display" />
						<span v-tooltip="t('settings_license_env_managed')" class="lock-badge">
							<VIcon name="lock" />
						</span>
					</div>
					<p class="env-managed-notice">{{ t('settings_license_env_managed') }}</p>
				</template>

				<template v-else-if="licenseSource === 'settings'">
					<div class="license-key-row">
						<VInput :model-value="t('settings_license_value_stored')" readonly class="license-key-display" />
						<span v-tooltip="t('settings_license_value_stored')" class="lock-badge">
							<VIcon name="lock" />
						</span>
						<VButton v-tooltip="t('settings_license_edit')" icon secondary @click="openDrawer">
							<VIcon name="edit" />
						</VButton>
					</div>
				</template>

				<template v-else>
					<div class="license-key-row">
						<VInput readonly :placeholder="t('settings_license_no_key')" class="license-key-display" />
						<VButton v-tooltip="t('settings_license_add')" icon secondary @click="openDrawer">
							<VIcon name="add" />
						</VButton>
					</div>
				</template>
			</div>

			<div v-if="showDeactivateSection" class="danger-zone-section">
				<h3 class="danger-zone-title">
					<VIcon name="warning" class="danger-icon" />
					{{ t('settings_license_danger_zone') }}
				</h3>
				<div class="danger-zone-content">
					<p class="danger-zone-notice">{{ t('settings_license_deactivate_notice') }}</p>
					<VButton kind="danger" :loading="deactivating" :disabled="deactivating" @click="confirmDeactivate = true">
						{{ t('settings_license_deactivate') }}
					</VButton>
				</div>
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
			v-if="licenseSource !== 'env'"
			v-model="drawerOpen"
			:title="t('license_key_management')"
			@cancel="closeDrawer"
		>
			<template #actions>
				<VButton v-tooltip.bottom="t('save')" :loading="saving" icon rounded @click="saveLicenseKey">
					<VIcon name="check" />
				</VButton>
			</template>

			<div class="drawer-content">
				<VNotice v-if="saveError" type="danger" class="save-error">
					{{ saveError }}
				</VNotice>
				<p class="drawer-notice">{{ t('license_key_management_notice') }}</p>
				<LicenseKeyInput
					v-model="editingKey"
					:has-existing-key="licenseSource === 'settings'"
					:utm-term="info.version"
					:license-payload="drawerPayload"
					utm-content="settings"
				/>
			</div>
		</VDrawer>
	</PrivateView>
</template>

<style scoped>
.license-page {
	padding: var(--content-padding);
	padding-block-end: var(--content-padding-bottom);
	max-inline-size: 600px;
}

.section-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin-block-end: 32px;
}

.tier-info {
	display: flex;
	align-items: center;
	gap: 12px;

	h2 {
		font-size: 20px;
		font-weight: 600;
		color: var(--theme--foreground-accent);
		margin: 0;
	}
}

.status-badge {
	font-size: 12px;
	font-weight: 500;
	padding: 4px 10px;
	border-radius: 6px;

	&.status-active {
		background: var(--theme--background-success);
		color: var(--theme--foreground-success);
	}

	&.status-expiring {
		background: var(--theme--background-warning);
		color: var(--theme--foreground-warning);
	}

	&.status-expired {
		background: var(--theme--background-danger);
		color: var(--theme--foreground-danger);
	}
}

.expiry-row {
	font-size: 14px;
	color: var(--theme--foreground-subdued);
	margin-block-end: 16px;
}

.grace-period-warning {
	margin-block-end: 24px;
}

.tier-icon {
	--v-icon-color: var(--theme--primary);
}

.license-key-section {
	display: grid;
	gap: 12px;

	h3 {
		font-size: 14px;
		font-weight: 600;
		color: var(--theme--foreground);
		margin: 0;
	}
}

.license-key-row {
	display: flex;
	gap: 8px;
	align-items: center;

	.license-key-display {
		flex: 1;
	}
}

.lock-badge {
	display: flex;
	align-items: center;
	justify-content: center;
	inline-size: 44px;
	block-size: 44px;
	color: var(--theme--foreground-subdued);
	flex-shrink: 0;
}

.env-managed-notice {
	font-size: 12px;
	color: var(--theme--foreground-subdued);
	margin: 0;
}

.drawer-content {
	padding: var(--content-padding);
	display: grid;
	gap: 24px;
}

.save-error {
	margin-block-end: 0;
}

.drawer-notice {
	font-size: 14px;
	color: var(--theme--foreground-subdued);
	margin: 0;
}

.danger-zone-section {
	margin-block-start: 48px;
	padding-block-start: 24px;
	border-block-start: 1px solid var(--theme--border-color);
}

.danger-zone-title {
	display: flex;
	align-items: center;
	gap: 8px;
	font-size: 14px;
	font-weight: 600;
	color: var(--theme--danger);
	margin: 0 0 12px;
}

.danger-icon {
	--v-icon-color: var(--theme--danger);
}

.danger-zone-content {
	display: grid;
	gap: 12px;
}

.danger-zone-notice {
	font-size: 14px;
	color: var(--theme--foreground-subdued);
	margin: 0;
}

.confirm-message {
	font-size: 14px;
	color: var(--theme--foreground);
	margin: 0 0 16px;
	padding-inline: 20px;
}
</style>

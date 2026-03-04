<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import SettingsNavigation from '../../components/navigation.vue';
import LicenseKeyInput from '@/components/license-key-input.vue';
import VBreadcrumb from '@/components/v-breadcrumb.vue';
import VButton from '@/components/v-button.vue';
import VDrawer from '@/components/v-drawer.vue';
import VIcon from '@/components/v-icon/v-icon.vue';
import VInput from '@/components/v-input.vue';
import { useServerStore } from '@/stores/server';
import { useSettingsStore } from '@/stores/settings';
import { PrivateView } from '@/views/private';

const { t } = useI18n();
const serverStore = useServerStore();
const settingsStore = useSettingsStore();
const { info } = storeToRefs(serverStore);

const drawerOpen = ref(false);
const editingKey = ref<string | null>(null);
const saving = ref(false);
const savedSuccessfully = ref(false);

const licenseSource = computed(() => info.value.license_source ?? null);
const tierName = computed(() => (info.value.license?.metadata?.policy?.name as string | undefined) ?? t('settings_license_tier'));
const drawerPayload = computed(() => (savedSuccessfully.value ? info.value.license : null));

function openDrawer() {
	editingKey.value = null;
	savedSuccessfully.value = false;
	drawerOpen.value = true;
}

async function saveLicenseKey() {
	saving.value = true;
	await settingsStore.updateSettings({ license_key: editingKey.value || null });
	await serverStore.hydrate();
	saving.value = false;
	savedSuccessfully.value = true;
}

watch(editingKey, () => {
	savedSuccessfully.value = false;
});

function closeDrawer() {
	drawerOpen.value = false;
	editingKey.value = null;
	savedSuccessfully.value = false;
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
				</div>
			</div>

			<div class="license-key-section">
				<h3>{{ t('license_key') }}</h3>

				<template v-if="licenseSource === 'env'">
					<div class="license-key-row">
						<VInput :model-value="'••••••••••••••••••••••••'" readonly class="license-key-display" />
						<span v-tooltip="t('settings_license_env_managed')" class="env-badge">
							<VIcon name="lock" />
						</span>
					</div>
					<p class="env-managed-notice">{{ t('settings_license_env_managed') }}</p>
				</template>

				<template v-else-if="licenseSource === 'settings'">
					<div class="license-key-row">
						<VInput :model-value="'••••••••••••••••••••••••'" readonly class="license-key-display" />
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
		</div>

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
				<p class="drawer-notice">{{ t('license_key_management_notice') }}</p>
				<LicenseKeyInput
					v-model="editingKey"
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

.env-badge {
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

.drawer-notice {
	font-size: 14px;
	color: var(--theme--foreground-subdued);
	margin: 0;
}
</style>

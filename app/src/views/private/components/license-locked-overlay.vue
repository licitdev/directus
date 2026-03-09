<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import VButton from '@/components/v-button.vue';
import VCard from '@/components/v-card.vue';
import VIcon from '@/components/v-icon/v-icon.vue';
import LicenseKeyInput from '@/modules/licensing/components/license-key-input.vue';
import { useServerStore } from '@/stores/server';
import { useSettingsStore } from '@/stores/settings';
import { notify } from '@/utils/notify';
import { unexpectedError } from '@/utils/unexpected-error';

const { t } = useI18n();
const serverStore = useServerStore();
const settingsStore = useSettingsStore();
const { info } = storeToRefs(serverStore);

const editingKey = ref<string | null>(null);
const saving = ref(false);

async function saveLicenseKey() {
	if (!editingKey.value?.trim()) return;

	saving.value = true;

	try {
		await settingsStore.updateSettings({ license_key: editingKey.value.trim() });
		await serverStore.hydrate();
		editingKey.value = null;
		notify({ title: t('license_valid'), type: 'success' });
	} catch (err: any) {
		unexpectedError(err);
	} finally {
		saving.value = false;
	}
}
</script>

<template>
	<div v-if="info.license_locked" class="license-locked-overlay">
		<div class="overlay-backdrop" />
		<div class="overlay-content">
			<VCard class="lock-card">
				<div class="lock-header">
					<VIcon name="lock" class="lock-icon" />
					<h2 class="lock-title">{{ t('license_project_locked') }}</h2>
					<p class="lock-notice">{{ t('license_project_locked_notice') }}</p>
				</div>
				<div class="lock-form">
					<LicenseKeyInput v-model="editingKey" :has-existing-key="false" utm-content="locked-overlay" />
					<VButton :loading="saving" :disabled="!editingKey?.trim() || saving" class="save-button" @click="saveLicenseKey">
						{{ t('save') }}
					</VButton>
				</div>
			</VCard>
		</div>
	</div>
</template>

<style scoped>
.license-locked-overlay {
	position: fixed;
	inset: 0;
	z-index: 1000;
	display: flex;
	align-items: center;
	justify-content: center;
}

.overlay-backdrop {
	position: absolute;
	inset: 0;
	background: var(--theme--background);
	opacity: 0.95;
}

.overlay-content {
	position: relative;
	inline-size: 100%;
	max-inline-size: 480px;
	padding: 24px;
}

.lock-card {
	padding: 32px;
}

.lock-header {
	text-align: center;
	margin-block-end: 24px;
}

.lock-icon {
	--v-icon-color: var(--theme--danger);
	font-size: 48px;
	margin-block-end: 16px;
}

.lock-title {
	font-size: 20px;
	font-weight: 600;
	color: var(--theme--foreground);
	margin: 0 0 8px;
}

.lock-notice {
	font-size: 14px;
	color: var(--theme--foreground-subdued);
	margin: 0;
}

.lock-form {
	display: grid;
	gap: 20px;
}

.save-button {
	justify-self: start;
}
</style>

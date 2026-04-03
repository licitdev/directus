<script setup lang="ts">
import { ref } from 'vue';
import PurchaseAddonModal from './purchase-addon-modal.vue';
import VButton from '@/components/v-button.vue';
import VIcon from '@/components/v-icon/v-icon.vue';
import VNotice from '@/components/v-notice.vue';
import VProgressCircular from '@/components/v-progress-circular.vue';

type Addon = {
	id: string;
	name: string;
	description: string;
	icon: string;
	disabled: boolean;
	showPurchase: boolean;
	showManage: boolean;
	showUpgradePlan: boolean;
};

defineProps<{
	addons: Addon[];
	addonsLoading: boolean;
	addonsError: string | null;
	version: string;
}>();

const showPurchaseModal = ref(false);
const selectedAddonInfo = ref<string | null>(null);

function openPurchaseModal(addon: Addon) {
	if (addon.id) {
		selectedAddonInfo.value = addon.id;
		showPurchaseModal.value = true;
	}
}
</script>

<template>
	<div class="add-on-section">
		<h3 class="section-title">
			<VIcon name="diamond" class="section-icon" />
			{{ $t('settings_license_add_on_packages') }}
		</h3>
		<div class="add-on-grid">
			<div v-if="addonsLoading" class="add-on-loading">
				<VProgressCircular indeterminate small />
				<span>{{ $t('loading') }}</span>
			</div>
			<VNotice v-else-if="addonsError" type="danger" class="add-on-error">
				{{ addonsError }}
			</VNotice>
			<template v-else>
				<div v-for="pkg in addons" :key="pkg.id" class="add-on-card" :class="{ disabled: pkg.disabled }">
					<div class="add-on-icon-wrapper">
						<VIcon :name="pkg.icon" class="add-on-icon" />
					</div>
					<div class="add-on-content">
						<span class="add-on-title">{{ pkg.name }}</span>
						<span v-if="pkg.description" class="add-on-description">{{ pkg.description }}</span>
					</div>
					<VButton
						v-if="pkg.showPurchase"
						secondary
						small
						class="add-on-purchase-btn"
						:disabled="pkg.disabled"
						@click="openPurchaseModal(pkg)"
					>
						<VIcon name="add_shopping_cart" class="add-on-purchase-icon" />
						{{ $t('settings_license_purchase') }}
					</VButton>
					<VButton v-else-if="pkg.showManage" secondary small class="add-on-manage-btn" :disabled="pkg.disabled">
						<VIcon name="settings" class="add-on-manage-icon" />
						{{ $t('settings_license_manage_addon') }}
					</VButton>
					<VButton v-else-if="pkg.showUpgradePlan" secondary small class="add-on-upgrade-btn" :disabled="pkg.disabled">
						<VIcon name="diamond" class="add-on-upgrade-icon" />
						{{ $t('settings_license_upgrade_plan') }}
					</VButton>
				</div>
			</template>
		</div>
	</div>

	<PurchaseAddonModal v-if="selectedAddonInfo" v-model="showPurchaseModal" :addon-id="selectedAddonInfo" />
</template>

<style scoped>
.add-on-section {
	margin-block-end: 2rem;
}

.section-title {
	display: flex;
	align-items: center;
	gap: 0.5rem;
	font-size: 1.5rem;
	font-weight: 600;
	color: var(--theme--foreground);
	margin: 0 0 1rem;
}

.section-icon {
	--v-icon-color: var(--theme--primary);
}

.add-on-loading {
	display: flex;
	align-items: center;
	gap: 0.75rem;
	padding: 1rem 1.25rem;
	color: var(--theme--foreground-subdued);
	font-size: 0.875rem;
}

.add-on-error {
	margin-block-end: 0;
}

.add-on-grid {
	display: grid;
	grid-template-columns: 1fr;
	gap: 0.75rem;
}

.add-on-card {
	--add-on-card-background: var(--theme--background-normal);
	display: flex;
	align-items: center;
	gap: 1rem;
	padding: 1rem 1.25rem;
	background: var(--add-on-card-background);
	border-radius: 0.5rem;

	--v-addon-icon-background: var(--theme--primary);
	--addon-title-color: var(--theme--foreground);

	&.disabled {
		--v-addon-icon-background: var(--theme--foreground-subdued);
		--add-on-card-background: var(--theme--background-subdued);
		--addon-title-color: var(--theme--foreground-subdued);
	}
}

.add-on-icon-wrapper {
	display: flex;
	align-items: center;
	justify-content: center;
	inline-size: 2.5rem;
	block-size: 2.5rem;
	border-radius: 50%;
	background: var(--v-addon-icon-background);
	flex-shrink: 0;
}

.add-on-icon {
	--v-icon-color: var(--white);
	--v-icon-size: 1.375rem;
	flex-shrink: 0;
}

.add-on-content {
	display: flex;
	flex-direction: column;
	gap: 0.25rem;
	flex: 1;
	min-inline-size: 0;
}

.add-on-purchase-btn {
	--v-button-background-color: var(--theme--background-accent);
	white-space: nowrap;
	flex-shrink: 0;
}

.add-on-purchase-icon {
	--v-icon-size: 1.125rem;
	margin-inline-end: 0.375rem;
}

.add-on-manage-btn {
	--v-button-background-color: var(--theme--background-accent);
	white-space: nowrap;
	flex-shrink: 0;
}

.add-on-manage-icon {
	--v-icon-size: 1.125rem;
	margin-inline-end: 0.375rem;
}

.add-on-upgrade-btn {
	white-space: nowrap;
	flex-shrink: 0;

	--v-button-color: var(--theme--foreground-subdued);
}

.add-on-upgrade-btn :deep(.button:disabled) {
	cursor: default;
}

.add-on-upgrade-icon {
	--v-icon-size: 1.125rem;
	margin-inline-end: 0.375rem;
}

.add-on-title {
	font-size: 0.875rem;
	font-weight: 600;
	color: var(--addon-title-color);
}

.add-on-description {
	font-size: 0.8125rem;
	color: var(--theme--foreground-subdued);
}
</style>

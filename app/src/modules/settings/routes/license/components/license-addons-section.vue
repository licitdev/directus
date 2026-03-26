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
	status: string;
	action: string;
	icon: string;
	showPurchase: boolean;
	showInfo: boolean;
	disabled?: boolean;
	showUpgradePlan?: boolean;
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
					<div class="add-on-icon-wrapper" :class="{ disabled: pkg.disabled }">
						<VIcon :name="pkg.icon" class="add-on-icon" />
					</div>
					<div class="add-on-content">
						<span class="add-on-title" :class="{ disabled: pkg.disabled }">
							{{ pkg.name }}
						</span>
						<span v-if="pkg.description" class="add-on-description" :class="{ disabled: pkg.disabled }">
							{{ pkg.description }}
						</span>
					</div>
					<VButton v-if="pkg.showPurchase" secondary small class="add-on-purchase-btn" @click="openPurchaseModal(pkg)">
						<VIcon name="add_shopping_cart" class="add-on-purchase-icon" />
						{{ $t('settings_license_purchase') }}
					</VButton>
					<VButton v-else-if="pkg.showUpgradePlan" secondary small class="add-on-upgrade-btn" disabled>
						<VIcon name="diamond" class="add-on-upgrade-icon" />
						{{ $t('settings_license_upgrade_plan') }}
					</VButton>
					<VIcon
						v-else-if="pkg.showInfo"
						v-tooltip.bottom="$t('settings_license_add_on_info')"
						name="info"
						class="add-on-info-icon"
					/>
				</div>
			</template>
		</div>
	</div>

	<PurchaseAddonModal v-if="selectedAddonInfo" v-model="showPurchaseModal" :addon-id="selectedAddonInfo" />
</template>

<style scoped>
.add-on-section {
	margin-block-end: 32px;
}

.section-title {
	display: flex;
	align-items: center;
	gap: 8px;
	font-size: 25px;
	font-weight: 600;
	color: var(--theme--foreground);
	margin: 0 0 16px;
}

.section-icon {
	--v-icon-color: var(--theme--primary);
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

.add-on-icon-wrapper.disabled {
	background: var(--theme--background-normal);
}

.add-on-icon-wrapper.disabled .add-on-icon {
	--v-icon-color: var(--theme--foreground-subdued);
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

.add-on-purchase-icon {
	--v-icon-size: 18px;
	margin-inline-end: 6px;
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
	--v-icon-color: var(--theme--foreground-subdued);
	--v-icon-size: 18px;
	margin-inline-end: 6px;
}

.add-on-title {
	font-size: 14px;
	font-weight: 600;
	color: var(--theme--foreground);
}

.add-on-title.disabled {
	color: var(--theme--foreground-subdued);
}

.add-on-description {
	font-size: 13px;
	color: var(--theme--foreground-subdued);
}

.add-on-description.disabled {
	color: var(--theme--foreground-subdued);
	opacity: 0.8;
}
</style>

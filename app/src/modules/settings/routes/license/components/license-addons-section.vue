<script setup lang="ts">
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
};

defineProps<{
	addons: Addon[];
	addonsLoading: boolean;
	addonsError: string | null;
	version: string;
}>();
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
				<div v-for="pkg in addons" :key="pkg.id" class="add-on-card">
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
						:href="`https://directus.io/license-request?utm_source=self_hosted&utm_medium=product&utm_campaign=2025_10_kyc&utm_term=${version}&utm_content=settings_addon_${pkg.id}`"
						target="_blank"
					>
						{{ $t('settings_license_purchase') }}
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
</style>

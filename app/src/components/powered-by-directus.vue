<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import VIcon from '@/components/v-icon/v-icon.vue';

const props = defineProps<{
	/** Light variant: white background, dark text (for dark backgrounds) */
	isOIG?: boolean;
}>();

const { t } = useI18n();
const label = ref(props.isOIG ? t('brand_oig_label') : t('brand_directus_label'));
</script>

<template>
	<a class="powered-by-directus" href="https://directus.io" target="_blank" rel="noopener noreferrer">
		<VIcon name="directus" class="icon" small />
		<span class="text">{{ label }}</span>
	</a>
</template>

<style scoped>
.powered-by-directus {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	gap: 8px;
	inline-size: fit-content;
	padding: 10px 18px;
	border-radius: var(--theme--border-radius);
	border: 1px solid var(--theme--border-color);
	box-shadow: 0 2px 8px color-mix(in srgb, var(--black) 15%, transparent);

	background-color: var(--white);
	color: var(--black);
	text-decoration: none;
	font-size: 12px;
	line-height: 1.2;
	transition: opacity var(--fast) var(--transition);
}

.powered-by-directus:hover {
	opacity: 0.9;
}

.icon {
	--v-icon-color: var(--black);
	flex-shrink: 0;
}

.text {
	white-space: nowrap;
}
</style>

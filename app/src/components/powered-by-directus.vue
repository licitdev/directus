<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import VIcon from '@/components/v-icon/v-icon.vue';

defineProps<{
	/** Light variant: white background, dark text (for dark backgrounds) */
	light?: boolean;
}>();

const { t } = useI18n();
</script>

<template>
	<a
		class="powered-by-directus"
		:class="{ light }"
		href="https://directus.io"
		target="_blank"
		rel="noopener noreferrer"
	>
		<VIcon name="directus" class="icon" small />
		<span class="text">{{ t('powered_by_directus') }}</span>
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
	background-color: var(--project-color, var(--theme--primary));
	color: var(--white);
	text-decoration: none;
	font-size: 12px;
	line-height: 1.2;
	transition: opacity var(--fast) var(--transition);
}

.powered-by-directus.light {
	background-color: var(--white);
	color: var(--black);
	border: 1px solid var(--theme--border-color);
	box-shadow: 0 2px 8px color-mix(in srgb, var(--black) 15%, transparent);
}

.powered-by-directus.light .icon {
	--v-icon-color: var(--project-color, var(--theme--primary));
}

.powered-by-directus:hover {
	opacity: 0.9;
}

.icon {
	--v-icon-color: var(--white);
	flex-shrink: 0;
}

.text {
	white-space: nowrap;
}
</style>

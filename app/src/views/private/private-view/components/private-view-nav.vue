<script setup lang="ts">
import PrivateViewNavProjectName from './private-view-nav-project-name.vue';

// id attribute for accessibility linking doesn’t work on the top-level element
defineProps<{ id?: string }>();
</script>

<template>
	<aside role="navigation" aria-label="Module Navigation" class="module-nav alt-colors">
		<PrivateViewNavProjectName />

		<div :id class="module-nav-content">
			<slot name="navigation" />
		</div>

		<div v-if="$slots.footer" class="module-nav-footer">
			<slot name="footer" />
		</div>
	</aside>
</template>

<style scoped>
.module-nav {
	block-size: 100%;
	inline-size: 100%;
	position: relative;
	display: flex;
	flex-direction: column;
	font-size: 1rem;
	background: var(--theme--navigation--background);
}

.module-nav-content {
	--v-list-item-color: var(--theme--navigation--list--foreground);
	--v-list-item-color-hover: var(--theme--navigation--list--foreground-hover);
	--v-list-item-color-active: var(--theme--navigation--list--foreground-active);
	--v-list-item-icon-color: var(--theme--navigation--list--icon--foreground);
	--v-list-item-icon-color-hover: var(--theme--navigation--list--icon--foreground-hover);
	--v-list-item-icon-color-active: var(--theme--navigation--list--icon--foreground-active);
	--v-list-item-background-color: var(--theme--navigation--list--background);
	--v-list-item-background-color-hover: var(--theme--navigation--list--background-hover);
	--v-list-item-background-color-active: var(--theme--navigation--list--background-active);
	--v-divider-color: var(--theme--navigation--list--divider--border-color);
	--v-divider-thickness: var(--theme--navigation--list--divider--border-width);
	--project-header-height: 60px;

	flex: 1;
	min-block-size: 0;
	overflow: hidden auto;
	border-inline-end: var(--theme--navigation--border-width) solid var(--theme--navigation--border-color);
}

.module-nav-footer {
	display: flex;
	justify-content: center;
	flex-shrink: 0;
	padding: 12px 16px;
	border-block-start: var(--theme--navigation--border-width) solid var(--theme--navigation--border-color);
}
</style>

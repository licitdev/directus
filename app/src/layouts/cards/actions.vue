<script setup lang="ts">
defineOptions({ inheritAttrs: false });

defineProps<{
	showingCount?: string;
	layoutProps?: { showingUsage?: string };
}>();
</script>

<template>
	<Transition name="fade">
		<span v-if="layoutProps?.showingUsage ?? showingCount" class="item-count">
			{{ layoutProps?.showingUsage ?? showingCount }}
		</span>
	</Transition>
</template>

<style lang="scss" scoped>
.item-count {
	position: relative;
	display: none;
	color: var(--theme--foreground-subdued);
	white-space: nowrap;

	@media (width > 640px) {
		display: inline;
	}
}

.fade-enter-active,
.fade-leave-active {
	transition: opacity var(--medium) var(--transition);
}

.fade-enter-from,
.fade-leave-to {
	opacity: 0;
}
</style>

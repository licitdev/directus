<script setup lang="ts" generic="T extends Item">
import { computed, ref } from 'vue';
import VCheckbox from '@/components/v-checkbox.vue';
import VDetail from '@/components/v-detail.vue';

export type Item = {
	name: string;
	value: string;
	description?: string;
};

const props = withDefaults(
	defineProps<{
		title: string;
		items: T[];
		modelValue: string[];
		itemsShown?: number;
	}>(),
	{
		itemsShown: 12,
	},
);

defineSlots<{
	item(props: { item: T }): any;
}>();

const emit = defineEmits<{
	(e: 'update:modelValue', value: string[]): void;
}>();

const showAll = ref(false);

const displayedItems = computed(() => {
	if (showAll.value || props.items.length <= props.itemsShown) {
		return props.items;
	}

	return props.items.slice(0, props.itemsShown);
});

function toggleSelection(value: string) {
	const newValue = [...props.modelValue];
	const index = newValue.indexOf(value);

	if (index === -1) {
		newValue.push(value);
	} else {
		newValue.splice(index, 1);
	}

	emit('update:modelValue', newValue);
}
</script>

<template>
	<div class="deactivation-select-list">
		<h3 class="title">{{ title }}</h3>

		<div class="items-grid">
			<div v-for="item in displayedItems" :key="item.value" class="item">
				<VCheckbox :model-value="modelValue.includes(item.value)" @update:model-value="toggleSelection(item.value)" />
				<slot name="item" :item="item">
					<div class="item-content">
						<p class="name">{{ item.name }}</p>
						<p v-if="item.description" class="description">{{ item.description }}</p>
					</div>
				</slot>
			</div>
		</div>

		<VDetail
			v-if="!showAll && items.length > itemsShown"
			:label="`Show ${items.length - itemsShown} more`"
			@update:model-value="showAll = true"
		/>
	</div>
</template>

<style scoped lang="scss">
.title {
	font-size: 1rem;
	font-weight: bold;
	padding-block-end: 0.5rem;
}

.deactivation-select-list {
	padding: 1rem;

	.items-grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 1rem;
		padding: 1rem;

		.item {
			display: flex;
			align-items: center;
			gap: 0.5rem;
			padding: 0.825rem;
			background-color: var(--theme--background-normal);
			border-radius: var(--theme--border-radius);

			.item-content {
				display: flex;
				flex-direction: column;
				overflow: hidden;
				cursor: pointer;

				.name {
					white-space: nowrap;
					overflow: hidden;
					text-overflow: ellipsis;
				}

				.description {
					font-size: 0.75rem;
					color: var(--theme--foreground-subdued);
					white-space: nowrap;
					overflow: hidden;
					text-overflow: ellipsis;
				}
			}
		}
	}
}
</style>

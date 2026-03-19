<script setup lang="ts" generic="T extends Item">
import { computed, ref } from 'vue';
import VCheckbox from '@/components/v-checkbox.vue';
import VDetail from '@/components/v-detail.vue';
import { getMinimalGridClass } from '@/utils/get-minimal-grid-class';

export type Item = {
	name: string;
	value: string;
	description?: string;
};

const props = withDefaults(
	defineProps<{
		items: T[];
		modelValue: string[];
		itemsShown?: number;
		helperText?: string;
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

const choices = computed(() => props.items.map((item) => ({ text: item.name })));

const gridClass = computed(() => getMinimalGridClass(choices.value));

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
		<div class="items-grid" :class="gridClass">
			<VCheckbox
				v-for="item in displayedItems"
				:key="item.value"
				block
				class="selectable-tile"
				:class="{ selected: modelValue.includes(item.value) }"
				:model-value="modelValue.includes(item.value)"
				@update:model-value="toggleSelection(item.value)"
			>
				<slot name="item" :item="item">
					<div class="item-content">
						<p class="name">{{ item.name }}</p>
						<p v-if="item.description" class="description">{{ item.description }}</p>
					</div>
				</slot>
			</VCheckbox>
		</div>

		<VDetail
			v-if="!showAll && items.length > itemsShown"
			:class="gridClass"
			:label="`Show ${items.length - itemsShown} more`"
			@update:model-value="showAll = true"
		/>
	</div>
</template>

<style scoped lang="scss">
.deactivation-select-list {
	.items-grid {
		--columns: 1;

		display: grid;
		gap: 0.75rem 2rem;
		grid-template-columns: repeat(var(--columns), minmax(0, 1fr));
	}

	.selectable-tile {
		border: 1px solid var(--theme--border-color);
		border-radius: var(--theme--border-radius);
		transition: all 0.2s ease;
	}

	.grid-2 {
		@media (width > 640px) {
			--columns: 2;
		}
	}

	.grid-3 {
		@media (width > 640px) {
			--columns: 3;
		}
	}

	.grid-4 {
		@media (width > 640px) {
			--columns: 4;
		}
	}

	.v-detail {
		margin-block: 0;

		&.grid-1 {
			grid-column: span 1;
		}

		&.grid-2 {
			grid-column: span 2;
		}

		&.grid-3 {
			grid-column: span 3;
		}

		&.grid-4 {
			grid-column: span 4;
		}
	}

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
</style>

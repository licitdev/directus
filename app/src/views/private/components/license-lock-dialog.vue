<script setup lang="ts">
import { computed } from 'vue';
import VCardTitle from '@/components/v-card-title.vue';
import VCard from '@/components/v-card.vue';
import VDialog from '@/components/v-dialog.vue';

const props = defineProps<{
	open: boolean;
}>();

const emit = defineEmits<{
	(e: 'update:open', value: boolean): void;
}>();

const openDialog = computed({
	get: () => props.open,
	set: (value: boolean) => emit('update:open', value),
});
</script>

<template>
	<VDialog v-model="openDialog">
		<VCard>
			<VCardTitle>Your project has been locked for license suspension.</VCardTitle>
			Contact your administrator to resolve this issue.
		</VCard>
	</VDialog>
</template>

<style scoped lang="scss"></style>

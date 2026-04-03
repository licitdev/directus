<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import VCardActions from '@/components/v-card-actions.vue';
import VCardText from '@/components/v-card-text.vue';
import VCardTitle from '@/components/v-card-title.vue';
import VCard from '@/components/v-card.vue';
import VDialog from '@/components/v-dialog.vue';

const props = defineProps<{
	open: boolean;
}>();

const emit = defineEmits<{
	(e: 'update:open', value: boolean): void;
}>();

const { t } = useI18n();

const openDialog = computed({
	get: () => props.open,
	set: (value: boolean) => emit('update:open', value),
});
</script>

<template>
	<VDialog v-model="openDialog">
		<VCard>
			<VCardTitle>{{ t('license_project_locked_deactivation_popup_title') }}</VCardTitle>
			<VCardText>{{ t('license_project_locked_deactivation_popup_text') }}</VCardText>
			<VCardActions />
		</VCard>
	</VDialog>
</template>

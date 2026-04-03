<script setup lang="ts">
import { computed, ref } from 'vue';
import RevisionItem from './revision-item.vue';
import VDetail from '@/components/v-detail.vue';
import VNotice from '@/components/v-notice.vue';
import { useServerStore } from '@/stores/server';
import { Revision, RevisionsByDate } from '@/types/revisions';

interface Props {
	group: RevisionsByDate;
}

defineProps<Props>();
defineEmits(['click']);

const expand = ref(true);
const serverStore = useServerStore();

const revisionsLimit = computed(() => {
	return serverStore.license.entitlements.revisions?.limit;
});
</script>

<template>
	<VDetail v-model="expand" :label="group.dateFormatted" class="revisions-date-group">
		<div v-show="expand" class="scroll-container">
			<RevisionItem
				v-for="(item, index) in group.revisions"
				:key="item.id"
				:revision="item as Revision"
				:last="index === group.revisions.length - 1"
				@click="$emit('click', item.id)"
			/>
			<div class="v-notice-wrapper">
				<VNotice type="info" icon="diamond">
					<template #title>
						{{ $t('feature_limit_notice', { limit: revisionsLimit, feature: $t('revisions') }) }}
					</template>
				</VNotice>
			</div>
		</div>
	</VDetail>
</template>

<style lang="scss" scoped>
.v-notice-wrapper {
	padding: var(--content-padding);

	.v-notice {
		background-color: var(--theme--background-accent);
	}
}
</style>

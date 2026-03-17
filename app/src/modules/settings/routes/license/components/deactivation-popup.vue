<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import DeactivationSelectList, { type Item } from './deactivation-select-list.vue';
import api from '@/api';
import VAvatar from '@/components/v-avatar.vue';
import VButton from '@/components/v-button.vue';
import VDialog from '@/components/v-dialog.vue';
import VDivider from '@/components/v-divider.vue';
import VIcon from '@/components/v-icon/v-icon.vue';
import VImage from '@/components/v-image.vue';
import VNotice from '@/components/v-notice.vue';
import { useCollectionsStore } from '@/stores/collections';
import { useServerStore } from '@/stores/server';
import { useSettingsStore } from '@/stores/settings';
import { getAssetUrl } from '@/utils/get-asset-url';
import { notify } from '@/utils/notify';
import { unexpectedError } from '@/utils/unexpected-error';
import DrawerItem from '@/views/private/components/drawer-item.vue';

type UserItem = Item & { avatar: string };

const props = defineProps<{
	open: boolean;
}>();

const emit = defineEmits<{
	(e: 'update:open', value: boolean): void;
}>();

const users = ref<UserItem[]>([]);
const usersLoading = ref(false);

const { t } = useI18n();
const serverStore = useServerStore();
const settingsStore = useSettingsStore();
const collectionsStore = useCollectionsStore();

const collections = computed(() => {
	const tableCollections = collectionsStore.databaseCollections.filter((collection) => collection.meta);
	return tableCollections.map((collection) => ({ name: collection.collection, value: collection.collection }));
});

const collectionsDefaultExceededCount = computed(() => {
	return serverStore.license.entitlements.collections?.defaultExceededCount ?? 0;
});

const usersDefaultExceededCount = computed(() => {
	return serverStore.license.entitlements.users?.defaultExceededCount ?? 0;
});

const deactivationNoticeMessage = computed(() => {
	const collectionsCount = collectionsDefaultExceededCount.value;
	const usersCount = usersDefaultExceededCount.value;

	const parts: string[] = [];

	if (collectionsCount > 0) {
		parts.push(t('settings_license_deactivation_popup_notice_collections', { count: collectionsCount }));
	}

	if (usersCount > 0) {
		parts.push(t('settings_license_deactivation_popup_notice_users', { count: usersCount }));
	}

	if (parts.length === 0) {
		return t('settings_license_deactivation_popup_notice_no_requirements');
	}

	return t('settings_license_deactivation_popup_notice_requirements', {
		requirements: parts.join(t('settings_license_deactivation_popup_notice_and')),
	});
});

const deactivating = ref(false);
const selectedUserKey = ref<string | null>(null);
const userDrawerActive = ref(false);

const selectedCollections = ref<string[]>([]);
const selectedUsers = ref<string[]>([]);

const confirmDeactivate = computed({
	get: () => props.open,
	set: (value: boolean) => emit('update:open', value),
});

async function fetchUsers() {
	usersLoading.value = true;

	async function getAvatarSrc(item: { avatar: string }) {
		if (!item.avatar) return;

		return getAssetUrl(item.avatar, {
			imageKey: 'system-small-contain',
		});
	}

	try {
		const response = await api.get('/users');

		const newUsers = [];

		for (const user of response.data.data ?? []) {
			const avatar = await getAvatarSrc(user);

			newUsers.push({
				name: user.first_name && user.last_name ? `${user.first_name} ${user.last_name}` : (user.email ?? user.id),
				value: user.id,
				avatar: avatar,
			} as UserItem);
		}

		users.value = newUsers;
	} catch (err: any) {
		unexpectedError(err);
	} finally {
		usersLoading.value = false;
	}
}

watch(
	() => props.open,
	(open) => {
		if (open && users.value.length === 0) {
			void fetchUsers();
		}
	},
);

async function deactivateLicense() {
	deactivating.value = true;
	confirmDeactivate.value = false;

	try {
		await api.post('/server/deactivate-license', {
			collections: selectedCollections.value,
			users: selectedUsers.value,
		});

		await Promise.all([serverStore.hydrate(), settingsStore.hydrate()]);
		notify({ title: t('settings_license_deactivate_success') });
	} catch (err: any) {
		unexpectedError(err);
	} finally {
		deactivating.value = false;
	}
}
</script>

<template>
	<VDialog v-model="confirmDeactivate" keep-behind @esc="confirmDeactivate = false">
		<div class="deactivation-popup">
			<div class="deactivation-popup-header">
				<h2>{{ t('settings_license_deactivation_popup_title') }}</h2>
				<p>{{ t('settings_license_deactivation_popup_subtitle') }}</p>
			</div>
			<VDivider />

			<div class="notice-wrapper">
				<VNotice type="warning">
					{{ deactivationNoticeMessage }}
				</VNotice>
			</div>

			<DeactivationSelectList
				v-if="collectionsDefaultExceededCount > 0"
				v-model="selectedCollections"
				title="Data Collections"
				:items="collections"
			/>

			<DeactivationSelectList
				v-if="usersDefaultExceededCount > 0"
				v-model="selectedUsers"
				title="User Seats"
				:items="users"
			>
				<template #item="{ item }">
					<div class="user-item">
						<VAvatar x-small round class="avatar">
							<VIcon v-if="!item.avatar" name="person" />
							<VImage v-else :src="item.avatar" :alt="$t('avatar')" />
						</VAvatar>
						<div class="item-content">
							<p class="name">{{ item.name }}</p>
						</div>
						<VIcon
							name="launch"
							class="launch-btn"
							clickable
							@click.stop="
								selectedUserKey = item.value;
								userDrawerActive = true;
							"
						/>
					</div>
				</template>
			</DeactivationSelectList>

			<div class="deactivation-popup-actions">
				<VButton secondary @click="confirmDeactivate = false">
					{{ t('cancel') }}
				</VButton>
				<VButton kind="danger" :loading="deactivating" @click="deactivateLicense">
					{{ t('settings_license_deactivation_popup_confirm') }}
				</VButton>
			</div>
		</div>
	</VDialog>
	<DrawerItem
		v-if="selectedUserKey"
		v-model:active="userDrawerActive"
		collection="directus_users"
		:primary-key="selectedUserKey"
		disabled
	/>
</template>

<style scoped lang="scss">
.deactivation-popup {
	background: var(--theme--background);
	box-shadow: var(--theme--shadow);
	display: flex;
	flex-direction: column;
	border-radius: var(--theme--border-radius);
	inline-size: max(100% - 8vw, 100% - var(--header-bar-height) * 2);
}

.deactivation-popup-header {
	padding: 1rem 1.5rem 0.5rem;
	h2 {
		font-size: 1.5rem;
		font-weight: bold;
		padding-block-end: 0.5rem;
	}
	p {
		font-size: 0.875rem;
	}
}

.deactivation-popup-actions {
	display: flex;
	justify-content: flex-end;
	padding: 1rem;
	gap: 1rem;
}

.notice-wrapper {
	padding: var(--content-padding);
}

.user-item {
	display: flex;
	align-items: center;
	gap: 0.5rem;
	overflow: hidden;
	inline-size: 100%;

	.launch-btn {
		margin-inline-start: auto;
	}

	.avatar {
		flex-shrink: 0;
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
	}
}
</style>

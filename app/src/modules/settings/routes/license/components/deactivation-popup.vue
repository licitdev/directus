<script setup lang="ts">
import { User } from '@directus/types';
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import DeactivationSelectList, { type Item } from './deactivation-select-list.vue';
import api from '@/api';
import VAvatar from '@/components/v-avatar.vue';
import VButton from '@/components/v-button.vue';
import VCardActions from '@/components/v-card-actions.vue';
import VCardTitle from '@/components/v-card-title.vue';
import VCard from '@/components/v-card.vue';
import VCheckbox from '@/components/v-checkbox.vue';
import VChip from '@/components/v-chip.vue';
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

const props = withDefaults(
	defineProps<{
		open: boolean;
		notice?: string;
		isSuspended?: boolean;
		title?: string;
	}>(),
	{
		isSuspended: false,
	},
);

const emit = defineEmits<{
	(e: 'update:open', value: boolean): void;
}>();

const users = ref<UserItem[]>([]);
const adminUsers = ref<UserItem[]>([]);
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

	if (props.isSuspended) {
		return t('license_suspended_deactivation_popup_notice', {
			requirements: parts.join(t('settings_license_deactivation_popup_notice_and')),
		});
	}

	return t('settings_license_deactivation_popup_notice_requirements', {
		requirements: parts.join(t('settings_license_deactivation_popup_notice_and')),
	});
});

const deactivating = ref(false);
const showedUserInfoKey = ref<string | null>(null);
const userDrawerActive = ref(false);
const confirmDeactivate = ref(false);
const ssoForceLogoutAcknowledged = ref(false);

const selectedCollections = ref<string[]>([]);
const selectedUsers = ref<string[]>([]);

const collectionLimit = computed(() => {
	if (collectionsDefaultExceededCount.value <= 0) return 0;

	return collectionsDefaultExceededCount.value - selectedCollections.value.length;
});

const userLimit = computed(() => {
	if (usersDefaultExceededCount.value <= 0) return 0;

	return usersDefaultExceededCount.value - selectedUsers.value.length;
});

const openDeactivatePopup = computed({
	get: () => props.open,
	set: (value: boolean) => emit('update:open', value),
});

const disabledDeactivateButton = computed(() => {
	const selectedCollectionsCount = selectedCollections.value.length;
	const selectedUsersCount = selectedUsers.value.length;

	if (selectedCollectionsCount === 0 && selectedUsersCount === 0) {
		return true;
	}

	if (!!userLimit.value || !!collectionLimit.value) {
		return true;
	}

	return !ssoForceLogoutAcknowledged.value;
});

async function fetchUsers() {
	usersLoading.value = true;

	async function getAvatarSrc(item: User) {
		if (!item.avatar) return;

		if (typeof item.avatar === 'string') {
			return getAssetUrl(item.avatar, {
				imageKey: 'system-small-contain',
			});
		}

		return '';
	}

	try {
		const appUserResponse = await api.get('/users', {
			params: {
				filter: {
					_and: [
						{
							status: 'active',
						},
						{
							_or: [
								{
									policies: {
										policy: {
											app_access: true,
											admin_access: false,
										},
									},
								},
								{
									role: {
										policies: {
											policy: {
												app_access: true,
												admin_access: false,
											},
										},
									},
								},
							],
						},
					],
				},
				fields: ['*', 'policies.policy.*', 'role.policies.policy.*'],
			},
		});

		const adminUserResponse = await api.get('/users', {
			params: {
				filter: {
					_and: [
						{
							status: 'active',
						},
						{
							_or: [
								{
									policies: {
										policy: {
											admin_access: true,
											app_access: true,
										},
									},
								},
								{
									role: {
										policies: {
											policy: {
												admin_access: true,
												app_access: true,
											},
										},
									},
								},
							],
						},
					],
				},
			},
		});

		const mapUser = async (data: User[]) => {
			const result: UserItem[] = [];

			for (const user of data ?? []) {
				const avatar = await getAvatarSrc(user);

				result.push({
					name: user.first_name && user.last_name ? `${user.first_name} ${user.last_name}` : (user.email ?? user.id),
					value: user.id,
					avatar: avatar,
				} as UserItem);
			}

			return result;
		};

		users.value = await mapUser(appUserResponse.data?.data as User[]);
		adminUsers.value = await mapUser(adminUserResponse.data?.data as User[]);
	} catch (err: any) {
		unexpectedError(err);
	} finally {
		usersLoading.value = false;
	}
}

void fetchUsers();

async function deactivateLicense() {
	deactivating.value = true;

	try {
		await api.post('/server/deactivate-license', {
			deactivate_sso: ssoForceLogoutAcknowledged.value,
		});

		await Promise.all([serverStore.hydrate(), settingsStore.hydrate()]);
		notify({ title: t('settings_license_deactivate_success') });
	} catch (err: any) {
		unexpectedError(err);
	} finally {
		deactivating.value = false;
		confirmDeactivate.value = false;
		openDeactivatePopup.value = false;
	}
}

async function archiveUsers(userIds: string[]) {
	if (!userIds.length) return;

	try {
		const response = await api.patch(
			'/users',
			userIds.map((id) => ({ id, status: 'deactivated' })),
		);

		return response?.data?.data;
	} catch (error: unknown) {
		unexpectedError(error);
	}
}

async function excludeCollections(collectionKeys: string[]) {
	if (!collectionKeys.length) return;

	try {
		const response = await api.patch(
			'/collections',
			collectionKeys.map((collection) => ({
				collection,
				meta: { excluded: true },
			})),
		);

		return response?.data?.data;
	} catch (error: unknown) {
		unexpectedError(error);
	}
}

async function handleDeactivation() {
	if (selectedUsers.value.length > 0) {
		const response = await archiveUsers(selectedUsers.value);

		if (!response) {
			notify({ title: t('error_archiving_users') });
			return;
		}
	}

	if (selectedCollections.value.length > 0) {
		const response = await excludeCollections(selectedCollections.value);

		if (!response) {
			notify({ title: t('error_excluding_collections') });
			return;
		}
	}

	await deactivateLicense();
}

async function onClickDeactivate() {
	confirmDeactivate.value = true;
}
</script>

<template>
	<VDialog v-model="openDeactivatePopup" keep-behind @esc="openDeactivatePopup = false">
		<div class="deactivation-popup">
			<div class="deactivation-popup-header">
				<h2 class="title">{{ props.title ?? t('settings_license_deactivation_popup_title') }}</h2>
				<p class="subtitle">{{ t('settings_license_deactivation_popup_subtitle') }}</p>
			</div>

			<div class="deactivation-popup-body">
				<div class="notice-wrapper">
					<VNotice v-if="!disabledDeactivateButton" type="danger" icon="error">
						{{ deactivationNoticeMessage }}
					</VNotice>
				</div>
				<div class="deactivation-popup-list-wrapper">
					<div class="list-header">
						<VIcon name="database" class="header-icon" />
						<h3 class="title">Data Collections</h3>
						<VChip
							x-small
							class="badge"
							:class="{
								danger: collectionLimit > 0,
								info: collectionLimit === 0,
								success: collectionLimit === 0 && selectedCollections.length,
							}"
						>
							<div v-if="collectionLimit === 0 && selectedCollections.length">
								{{ t('settings_license_deactivation_popup_limit_count_success') }}
							</div>
							<div v-else>
								{{ t('settings_license_deactivation_popup_remaining', { count: collectionLimit }) }}
							</div>
						</VChip>
					</div>

					<VDivider />

					<p class="helper-text">Select collections to deactivate</p>

					<DeactivationSelectList v-model="selectedCollections" :items="collections" />
				</div>

				<div class="deactivation-popup-list-wrapper">
					<div class="list-header">
						<VIcon name="group" class="header-icon" />
						<h3 class="title">User Seats</h3>
						<VChip
							x-small
							class="badge"
							:class="{
								danger: userLimit > 0,
								info: userLimit === 0,
								success: userLimit === 0 && selectedUsers.length,
							}"
						>
							<div v-if="userLimit === 0 && selectedUsers.length">
								{{ t('settings_license_deactivation_popup_limit_count_success') }}
							</div>
							<div v-else>
								{{ t('settings_license_deactivation_popup_remaining', { count: userLimit }) }}
							</div>
						</VChip>
					</div>

					<VDivider />

					<div class="user-list-wrapper">
						<div class="user-seats-list">
							<p class="helper-text">Select user seat(s) to deactivate</p>

							<DeactivationSelectList
								v-model="selectedUsers"
								helper-text="Select user seat(s) to deactivate"
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
												showedUserInfoKey = item.value;
												userDrawerActive = true;
											"
										/>
									</div>
								</template>
							</DeactivationSelectList>

							<VCheckbox v-model="ssoForceLogoutAcknowledged" class="sso-logout-notice">
								{{ t('settings_license_deactivation_sso_force_logout_notice') }}
							</VCheckbox>
						</div>

						<div class="admin-seat-list">
							<p class="helper-text">Select admin seat(s) to deactivate</p>

							<DeactivationSelectList
								v-model="selectedUsers"
								helper-text="Select user seat(s) to deactivate"
								:items="adminUsers"
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
												showedUserInfoKey = item.value;
												userDrawerActive = true;
											"
										/>
									</div>
								</template>
							</DeactivationSelectList>
						</div>
					</div>
				</div>
			</div>

			<div class="deactivation-popup-actions">
				<VButton v-if="!isSuspended" secondary @click="openDeactivatePopup = false">
					{{ t('cancel') }}
				</VButton>
				<VButton kind="danger" :disabled="disabledDeactivateButton" @click="onClickDeactivate">
					{{ t('settings_license_deactivation_popup_confirm') }}
				</VButton>
			</div>
		</div>
	</VDialog>
	<VDialog v-model="confirmDeactivate" @esc="confirmDeactivate = false">
		<VCard>
			<VCardTitle>
				{{ t('settings_license_deactivate_confirm') }}
			</VCardTitle>
			<VCardActions>
				<VButton secondary :disabled="deactivating" @click="confirmDeactivate = false">
					{{ t('cancel') }}
				</VButton>
				<VButton kind="danger" :loading="deactivating" @click="handleDeactivation">
					{{ t('settings_license_deactivation_popup_confirm') }}
				</VButton>
			</VCardActions>
		</VCard>
	</VDialog>
	<DrawerItem
		v-if="showedUserInfoKey"
		v-model:active="userDrawerActive"
		collection="directus_users"
		:primary-key="showedUserInfoKey"
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
	max-block-size: max(100% - 8vh, 100% - var(--header-bar-height) * 2);
}

.deactivation-popup-body {
	overflow: scroll;
}

.deactivation-popup-header {
	padding: 1rem 1.5rem 0.5rem;

	.title {
		color: var(--theme--danger);
	}

	h2 {
		font-size: 1.5rem;
		font-weight: bold;
		padding-block-end: 0.5rem;
	}

	.subtitle {
		font-size: 0.875rem;
	}
}

.deactivation-popup-actions {
	display: flex;
	justify-content: flex-end;
	padding: 1rem;
	gap: 1rem;
	background-color: var(--theme--background-subdued);
	border-block-start: 1px solid var(--theme--border-color);
	border-end-start-radius: var(--theme--border-radius);
	border-end-end-radius: var(--theme--border-radius);
}

.notice-wrapper {
	padding: 0 1.5rem;
}

.user-item {
	display: flex;
	align-items: center;
	gap: 0.5rem;
	overflow: hidden;
	inline-size: 100%;

	.launch-btn {
		margin-inline-start: auto;

		--v-icon-color: var(--theme--foreground-subdued);

		&:hover {
			--v-icon-color: var(--theme--primary);
		}
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

.list-header {
	display: flex;
	align-items: center;
	gap: 0.5rem;

	.header-icon {
		--v-icon-color: var(--theme--foreground-subdued);
	}

	.title {
		font-size: 1.25rem;
	}

	.badge {
		font-weight: 600;

		&.danger {
			--v-chip-background-color: var(--theme--danger-background);
			--v-chip-color: var(--theme--danger);
		}

		&.info {
			--v-chip-background-color: var(--theme--info-background);
			--v-chip-color: var(--theme--info);
		}

		&.success {
			--v-chip-background-color: var(--theme--success-background);
			--v-chip-color: var(--theme--success);
		}
	}
}

.helper-text {
	font-size: 0.875rem;
	margin-block-end: 0.25rem;
	font-weight: 500;
}

.v-divider {
	margin: 1.5rem 0;
}

.deactivation-popup-list-wrapper {
	padding: 1.5rem;
}

.user-list-wrapper {
	row-gap: 2.25rem;
	display: flex;
	flex-direction: column;
}

.sso-logout-notice {
	margin-block-start: 0.75rem;
}
</style>

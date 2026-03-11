<script setup lang="ts">
import { useLayout } from '@directus/composables';
import { mergeFilters } from '@directus/utils';
import { computed, ref, toRefs } from 'vue';
import { useI18n } from 'vue-i18n';
import { onBeforeRouteLeave, onBeforeRouteUpdate } from 'vue-router';
import UsersNavigation from '../components/navigation.vue';
import useNavigation from '../composables/use-navigation';
import api from '@/api';
import { logout } from '@/auth';
import VBreadcrumb from '@/components/v-breadcrumb.vue';
import VButton from '@/components/v-button.vue';
import VCardActions from '@/components/v-card-actions.vue';
import VCardText from '@/components/v-card-text.vue';
import VCardTitle from '@/components/v-card-title.vue';
import VCard from '@/components/v-card.vue';
import VDialog from '@/components/v-dialog.vue';
import VInfo from '@/components/v-info.vue';
import VNotice from '@/components/v-notice.vue';
import { useCollectionPermissions } from '@/composables/use-permissions';
import { usePreset } from '@/composables/use-preset';
import { useServerStore } from '@/stores/server';
import { useUserStore } from '@/stores/user';
import { unexpectedError } from '@/utils/unexpected-error';
import { PrivateViewHeaderBarActionButton } from '@/views/private';
import { PrivateView } from '@/views/private';
import DrawerBatch from '@/views/private/components/drawer-batch.vue';
import ExportSidebarDetail from '@/views/private/components/export-sidebar-detail.vue';
import LayoutSidebarDetail from '@/views/private/components/layout-sidebar-detail.vue';
import SearchInput from '@/views/private/components/search-input.vue';
import UsersInvite from '@/views/private/components/users-invite.vue';

const props = defineProps<{ role?: string }>();

const { role } = toRefs(props);

const { t } = useI18n();
const { roles } = useNavigation(role);
const userInviteModalActive = ref(false);
const userLimitModalActive = ref(false);
const serverStore = useServerStore();
const userStore = useUserStore();

const layoutRef = ref();
const selection = ref<string[]>([]);

const { layout, layoutOptions, layoutQuery, filter, search, resetPreset } = usePreset(ref('directus_users'));
const { addNewLink } = useLinks();

const { confirmDelete, deleting, batchDelete, batchEditActive } = useBatch();

const { breadcrumb, title } = useBreadcrumb();

const remainingSeats = computed(() => serverStore.license.entitlements.users?.remaining_seats ?? 0);

const usersWarningLimit = computed(() => serverStore.license.entitlements.users?.warning_limit ?? 0);

const reachedUsersLimit = computed(() => remainingSeats.value === 0);

const approachingUsersLimit = computed(
	() => usersWarningLimit.value > 0 && remainingSeats.value > 0 && remainingSeats.value <= usersWarningLimit.value,
);

const roleFilter = computed(() => {
	if (props.role) {
		return {
			_and: [
				{
					role: {
						_eq: props.role,
					},
				},
			],
		};
	}

	return null;
});

const {
	createAllowed,
	updateAllowed: batchEditAllowed,
	deleteAllowed: batchDeleteAllowed,
} = useCollectionPermissions('directus_users');

const { readAllowed: rolesReadAllowed } = useCollectionPermissions('directus_roles');

const canInviteUsers = computed(() => {
	if (serverStore.auth.disableDefault === true) return false;

	return createAllowed.value && rolesReadAllowed.value;
});

const { layoutWrapper } = useLayout(layout);

onBeforeRouteLeave(() => {
	selection.value = [];
});

onBeforeRouteUpdate(() => {
	selection.value = [];
});

async function refresh() {
	await layoutRef.value?.state?.refresh?.();
	await serverStore.hydrateLicense();
}

function useBatch() {
	const confirmDelete = ref(false);
	const deleting = ref(false);

	const batchEditActive = ref(false);

	const error = ref<any>();

	return { batchEditActive, confirmDelete, deleting, batchDelete, error };

	async function batchDelete() {
		if (deleting.value) return;

		deleting.value = true;

		const batchPrimaryKeys = selection.value;

		try {
			await api.delete('/users', {
				data: batchPrimaryKeys,
			});

			// Check if the current user was among the deleted users
			const currentUserId = userStore.currentUser && 'id' in userStore.currentUser ? userStore.currentUser.id : null;

			if (
				currentUserId &&
				batchPrimaryKeys.some((key) => {
					return key === currentUserId;
				})
			) {
				await logout();
				return;
			}

			await refresh();

			selection.value = [];
			confirmDelete.value = false;
		} catch (e) {
			error.value = e;
			unexpectedError(e);
		} finally {
			deleting.value = false;
		}
	}
}

function useLinks() {
	const addNewLink = computed<string>(() => {
		return props.role ? `/users/roles/${props.role}/+` : '/users/+';
	});

	return { addNewLink };
}

function useBreadcrumb() {
	const breadcrumb = computed(() => {
		if (!props.role) return null;

		return [
			{
				name: t('user_directory'),
				to: `/users`,
			},
		];
	});

	const title = computed(() => {
		if (!props.role) return t('user_directory');
		return roles.value?.find((role) => role.id === props.role)?.name;
	});

	return { breadcrumb, title };
}

function clearFilters() {
	filter.value = null;
	search.value = null;
}

function onCreateUserClick() {
	if (reachedUsersLimit.value) {
		userLimitModalActive.value = true;
	}
}

function onPurchaseAddOnClick() {
	window.open('https://directus.io/pricing/', '_blank');
	userLimitModalActive.value = false;
}
</script>

<template>
	<component
		:is="layoutWrapper"
		ref="layoutRef"
		v-slot="{ layoutState }"
		v-model:selection="selection"
		v-model:layout-options="layoutOptions"
		v-model:layout-query="layoutQuery"
		:filter="mergeFilters(filter, roleFilter)"
		:filter-user="filter"
		:filter-system="roleFilter"
		:search="search"
		collection="directus_users"
		:reset-preset="resetPreset"
	>
		<PrivateView :title="title" icon="people_alt">
			<template v-if="breadcrumb" #headline>
				<VBreadcrumb :items="breadcrumb" />
			</template>

			<template #actions:prepend>
				<component :is="`layout-actions-${layout}`" v-bind="layoutState" />
			</template>

			<template #actions>
				<SearchInput v-model="search" v-model:filter="filter" collection="directus_users" small />

				<VDialog v-if="selection.length > 0" v-model="confirmDelete" @esc="confirmDelete = false" @apply="batchDelete">
					<template #activator="{ on }">
						<PrivateViewHeaderBarActionButton
							v-tooltip.bottom="batchDeleteAllowed ? $t('delete_label') : $t('not_allowed')"
							:disabled="batchDeleteAllowed !== true"
							class="action-delete"
							secondary
							icon="delete"
							@click="on"
						/>
					</template>

					<VCard>
						<VCardTitle>{{ $t('batch_delete_confirm', selection.length) }}</VCardTitle>

						<VCardActions>
							<VButton secondary @click="confirmDelete = false">
								{{ $t('cancel') }}
							</VButton>
							<VButton kind="danger" :loading="deleting" @click="batchDelete">
								{{ $t('delete_label') }}
							</VButton>
						</VCardActions>
					</VCard>
				</VDialog>

				<PrivateViewHeaderBarActionButton
					v-if="selection.length > 0"
					v-tooltip.bottom="batchEditAllowed ? $t('edit') : $t('not_allowed')"
					secondary
					:disabled="batchEditAllowed === false"
					icon="edit"
					@click="batchEditActive = true"
				/>

				<PrivateViewHeaderBarActionButton
					v-if="canInviteUsers"
					v-tooltip.bottom="$t('invite_users')"
					secondary
					icon="person_add"
					@click="userInviteModalActive = true"
				/>

				<PrivateViewHeaderBarActionButton
					v-tooltip.bottom="createAllowed ? $t('create_item') : $t('not_allowed')"
					:to="reachedUsersLimit ? undefined : addNewLink"
					:disabled="createAllowed === false"
					icon="add"
					@click="onCreateUserClick"
				/>
			</template>

			<template #navigation>
				<UsersNavigation :current-role="role" />
			</template>

			<UsersInvite v-if="canInviteUsers" v-model="userInviteModalActive" @update:model-value="refresh" />

			<component :is="`layout-${layout}`" v-bind="layoutState">
				<template #message>
					<VNotice v-if="reachedUsersLimit" type="danger" icon="cancel">
						<template #title>{{ $t('users_limit_reached_notice') }}</template>
					</VNotice>

					<VNotice v-if="approachingUsersLimit && !reachedUsersLimit" type="warning" icon="warning">
						<template #title>
							{{
								$t('users_approaching_limit_notice', {
									count: remainingSeats,
								})
							}}
						</template>
					</VNotice>
				</template>

				<template #no-results>
					<VInfo v-if="!filter && !search" :title="$t('user_count', 0)" icon="people_alt" center>
						{{ $t('no_users_copy') }}

						<template v-if="canInviteUsers" #append>
							<VButton
								:to="reachedUsersLimit ? undefined : role ? { path: `/users/roles/${role}/+` } : { path: '/users/+' }"
								@click="onCreateUserClick"
							>
								{{ $t('create_user') }}
							</VButton>
						</template>
					</VInfo>

					<VInfo v-else :title="$t('no_results')" icon="search" center>
						{{ $t('no_results_copy') }}

						<template #append>
							<VButton @click="clearFilters">{{ $t('clear_filters') }}</VButton>
						</template>
					</VInfo>
				</template>

				<template #no-items>
					<VInfo :title="$t('user_count', 0)" icon="people_alt" center>
						{{ $t('no_users_copy') }}

						<template v-if="canInviteUsers" #append>
							<VButton
								:to="reachedUsersLimit ? undefined : role ? { path: `/users/roles/${role}/+` } : { path: '/users/+' }"
								@click="onCreateUserClick"
							>
								{{ $t('create_user') }}
							</VButton>
						</template>
					</VInfo>
				</template>
			</component>

			<VDialog v-model="userLimitModalActive" persistent>
				<VCard>
					<VCardTitle>{{ $t('users_limit_modal_title') }}</VCardTitle>
					<VCardText>
						{{ userStore.isAdmin ? $t('users_limit_admin_modal_description') : $t('users_limit_modal_description') }}
					</VCardText>
					<VCardActions>
						<VButton secondary @click="userLimitModalActive = false">
							{{ $t('cancel') }}
						</VButton>
						<VButton v-if="userStore.isAdmin" @click="onPurchaseAddOnClick">
							{{ $t('purchase_add_on') }}
						</VButton>
					</VCardActions>
				</VCard>
			</VDialog>

			<DrawerBatch
				v-model:active="batchEditActive"
				:primary-keys="selection"
				collection="directus_users"
				@refresh="refresh"
			/>

			<template #sidebar>
				<LayoutSidebarDetail v-model="layout">
					<component :is="`layout-options-${layout}`" v-bind="layoutState" />
				</LayoutSidebarDetail>
				<component :is="`layout-sidebar-${layout}`" v-bind="layoutState" />
				<ExportSidebarDetail
					collection="directus_users"
					:layout-query="layoutQuery"
					:filter="mergeFilters(filter, roleFilter)"
					:search="search"
					@refresh="refresh"
				/>
			</template>
		</PrivateView>
	</component>
</template>

<style lang="scss" scoped>
.action-delete {
	--v-button-background-color-hover: var(--theme--danger) !important;
	--v-button-color-hover: var(--white) !important;
}

.header-icon {
	--v-button-color-disabled: var(--theme--foreground);
}
</style>

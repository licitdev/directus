import formatTitle from '@directus/format-title';
import { acceptHMRUpdate, defineStore } from 'pinia';
import { computed, reactive } from 'vue';
import api, { replaceQueue } from '@/api';
import { AUTH_SSO_DRIVERS, DEFAULT_AUTH_DRIVER, DEFAULT_AUTH_PROVIDER } from '@/constants';
import { i18n } from '@/lang';
import { AuthProvider } from '@/types/login';

export type Info = {
	project: null | {
		project_name: string | null;
		project_descriptor: string | null;
		project_logo: string | null;
		project_color: string | null;
		default_language: string | null;
		default_appearance: 'light' | 'dark' | 'auto';
		default_theme_light: string | null;
		default_theme_dark: string | null;
		theme_light_overrides: Record<string, unknown> | null;
		theme_dark_overrides: Record<string, unknown> | null;
		public_foreground: string | null;
		public_background: { id: string; type: string } | null;
		public_favicon: string | null;
		public_note: string | null;
		custom_css: string | null;
		public_registration: boolean | null;
		public_registration_verify_email: boolean | null;
	};
	mcp_enabled: boolean;
	ai_enabled: boolean;
	files?: {
		mimeTypeAllowList: string[];
	};
	setupCompleted: boolean;
	rateLimit?:
		| false
		| {
				points: number;
				duration: number;
		  };
	rateLimitGlobal?:
		| false
		| {
				points: number;
				duration: number;
		  };
	queryLimit?: {
		default: number;
		max: number;
	};
	websocket?:
		| false
		| {
				logs?:
					| false
					| {
							allowedLogLevels: Record<string, number>;
					  };
				rest?:
					| false
					| {
							authentication: string;
							path: string;
					  };
				graphql?:
					| false
					| {
							authentication: string;
							path: string;
					  };
				heartbeat?: boolean | number;
				collaborativeEditing?: boolean;
		  };
	version?: string;
	show_license_key_field?: boolean;
	license_source?: 'env' | 'settings' | null;
	license?: Record<string, any> | null;
	license_locked?: boolean;
	extensions?: {
		limit: number | null;
	};
	uploads?: {
		tus?: boolean;
		chunkSize?: number;
		maxConcurrency?: number;
	};
};

export type License = {
	entitlements: {
		collections?: { limit?: number; warning_limit?: number; usage?: number; defaultExceededCount?: number };
		users?: { remaining_seats?: number; warning_limit?: number; usage?: number; defaultExceededCount?: number };
		activity_feed?: { limit?: number };
		revisions?: { limit?: number };
		sso?: { enabled?: boolean };
		custom_permissions?: { enabled?: boolean };
		llm?: { enabled?: boolean };
	};
};

export type Auth = {
	providers: AuthProvider[];
	disableDefault: boolean;
};

export type Addon = {
	data: {
		id: string;
		name: string;
		description: string;
		status: 'available' | 'purchased';
		action: 'purchase' | 'info';
		icon?: string;
		disabled?: boolean;
	}[];
};

export const useServerStore = defineStore('serverStore', () => {
	const info = reactive<Info>({
		project: null,
		mcp_enabled: true,
		ai_enabled: true,
		files: undefined,
		setupCompleted: false,
		extensions: undefined,
		rateLimit: undefined,
		queryLimit: undefined,
		websocket: undefined,
		uploads: undefined,
	});

	const auth = reactive<Auth>({
		providers: [],
		disableDefault: false,
	});

	const license = reactive<License>({
		entitlements: {},
	});

	const addons = reactive<Addon>({
		data: [],
	});

	const providerOptions = computed(() => {
		const options = auth.providers
			.filter((provider) => !AUTH_SSO_DRIVERS.includes(provider.driver))
			.map((provider) => ({ text: formatTitle(provider.name), value: provider.name, driver: provider.driver }));

		if (!auth.disableDefault) {
			options.unshift({
				text: i18n.global.t('default_provider'),
				value: DEFAULT_AUTH_PROVIDER,
				driver: DEFAULT_AUTH_DRIVER,
			});
		}

		return options;
	});

	const hydrate = async () => {
		const [serverInfoResponse, authResponse, licenseResponse, addonsResponse] = await Promise.all([
			api.get(`/server/info`),
			api.get('/auth?sessionOnly'),
			api.get('/server/license'),
			api.get('/server/license/addons'),
		]);

		info.project = serverInfoResponse.data.data?.project;
		info.mcp_enabled = serverInfoResponse.data.data?.mcp_enabled;
		info.ai_enabled = serverInfoResponse.data.data?.ai_enabled;
		info.files = serverInfoResponse.data.data?.files;
		info.setupCompleted = serverInfoResponse.data.data?.setupCompleted;
		info.show_license_key_field = serverInfoResponse.data.data?.show_license_key_field ?? true;
		info.license_source = serverInfoResponse.data.data?.license_source ?? null;
		info.license = serverInfoResponse.data.data?.license ?? null;
		info.license_locked = serverInfoResponse.data.data?.license_locked ?? false;
		info.queryLimit = serverInfoResponse.data.data?.queryLimit;
		info.extensions = serverInfoResponse.data.data?.extensions;
		info.websocket = serverInfoResponse.data.data?.websocket;
		info.version = serverInfoResponse.data.data?.version;
		info.uploads = serverInfoResponse.data.data?.uploads;

		auth.providers = authResponse.data.data;
		auth.disableDefault = authResponse.data.disableDefault;

		license.entitlements = licenseResponse.data.data?.entitlements ?? {};

		addons.data = addonsResponse.data.data?.addons ?? [];

		if (serverInfoResponse.data.data?.rateLimit !== undefined) {
			if (serverInfoResponse.data.data?.rateLimit === false) {
				await replaceQueue();
			} else {
				const { duration, points } = serverInfoResponse.data.data.rateLimit;
				const intervalCap = 1;
				/** Interval for 1 point */
				const interval = Math.ceil((duration * 1000) / points);
				await replaceQueue({ intervalCap, interval });
			}
		}
	};

	const hydrateLicense = async () => {
		const response = await api.get('/server/license');

		if (response.data?.data) {
			license.entitlements = response.data.data.entitlements;
		}
	};

	const dehydrate = () => {
		info.project = null;

		auth.providers = [];
		auth.disableDefault = false;
	};

	return {
		info,
		auth,
		license,
		addons,
		providerOptions,
		hydrate,
		hydrateLicense,
		dehydrate,
	};
});

if (import.meta.hot) {
	import.meta.hot.accept(acceptHMRUpdate(useServerStore, import.meta.hot));
}

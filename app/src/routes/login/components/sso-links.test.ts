import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import { createI18n } from 'vue-i18n';
import SsoLinks from './sso-links.vue';
import type { AuthProvider } from '@/types/login';

vi.mock('vue-router', () => ({
	useRoute: vi.fn(() => ({ query: {} })),
}));

vi.mock('@/utils/get-root-path', () => ({
	getRootPath: vi.fn(() => '/'),
	getPublicURL: vi.fn(() => 'http://localhost/'),
}));

vi.mock('@/lang', () => ({
	translateAPIError: vi.fn((key: string) => key),
}));

const i18n = createI18n({ legacy: false });

// Stub child components to avoid deep rendering
const global = {
	plugins: [i18n],
	stubs: {
		VDivider: true,
		VNotice: true,
		VIcon: true,
		VInput: true,
		VTextOverflow: true,
		VProgressCircular: true,
		TransitionExpand: { template: '<slot />' },
	},
};

describe('SsoLinks', () => {
	it('renders no .sso-link elements when providers is empty', () => {
		const wrapper = mount(SsoLinks, {
			props: { providers: [] as AuthProvider[] },
			global,
		});

		expect(wrapper.findAll('.sso-link')).toHaveLength(0);
	});

	it('renders no .sso-link elements when providers contains only local drivers', () => {
		const providers: AuthProvider[] = [{ name: 'localauth', driver: 'local' }];

		const wrapper = mount(SsoLinks, { props: { providers }, global });

		expect(wrapper.findAll('.sso-link')).toHaveLength(0);
	});

	it('renders no .sso-link elements when providers contains only ldap drivers', () => {
		const providers: AuthProvider[] = [{ name: 'myldap', driver: 'ldap' }];

		const wrapper = mount(SsoLinks, { props: { providers }, global });

		expect(wrapper.findAll('.sso-link')).toHaveLength(0);
	});

	it('renders .sso-link elements when providers includes an oauth2 driver', () => {
		const providers: AuthProvider[] = [{ name: 'google', driver: 'oauth2', icon: 'google', label: 'Google' }];

		const wrapper = mount(SsoLinks, { props: { providers }, global });

		expect(wrapper.findAll('.sso-link')).toHaveLength(1);
	});

	it('renders .sso-link elements when providers includes an openid driver', () => {
		const providers: AuthProvider[] = [{ name: 'myoidc', driver: 'openid', label: 'My OIDC' }];

		const wrapper = mount(SsoLinks, { props: { providers }, global });

		expect(wrapper.findAll('.sso-link')).toHaveLength(1);
	});

	it('renders .sso-link elements when providers includes a saml driver', () => {
		const providers: AuthProvider[] = [{ name: 'mysaml', driver: 'saml', label: 'My SAML' }];

		const wrapper = mount(SsoLinks, { props: { providers }, global });

		expect(wrapper.findAll('.sso-link')).toHaveLength(1);
	});

	it('renders only SSO providers when mixed with non-SSO providers', () => {
		const providers: AuthProvider[] = [
			{ name: 'localauth', driver: 'local' },
			{ name: 'google', driver: 'oauth2', icon: 'google', label: 'Google' },
		];

		const wrapper = mount(SsoLinks, { props: { providers }, global });

		expect(wrapper.findAll('.sso-link')).toHaveLength(1);
	});
});

import { vi } from 'vitest';

vi.mock('@vueuse/integrations/useCookies', () => ({
	useCookies: () => ({
		get: vi.fn(),
		set: vi.fn(),
		remove: vi.fn(),
		addChangeListener: vi.fn(),
		removeChangeListener: vi.fn(),
	}),
}));

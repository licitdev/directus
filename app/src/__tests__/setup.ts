import { vi } from 'vitest';

// Mock useCookies to prevent universal-cookie from accessing document in setTimeout
// (causes "ReferenceError: document is not defined" in Node test environment)
vi.mock('@vueuse/integrations/useCookies', () => ({
	useCookies: () => ({
		get: vi.fn(),
		set: vi.fn(),
		remove: vi.fn(),
		addChangeListener: vi.fn(),
		removeChangeListener: vi.fn(),
	}),
}));

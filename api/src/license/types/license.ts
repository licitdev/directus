import type { EntitlementsType } from './entitlementsType.js';

export type License = {
	project_id: string;
	metadata: {
		license: {
			name: string;
			status: 'ACTIVE' | 'EXPIRED' | 'EXPIRING';
			expiry?: number;
			grace_period?: number;
		};
		policy: {
			name: string;
		};
		entitlements: EntitlementsType;
	};
};

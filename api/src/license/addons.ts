/**
 * Mock add-on metadata for the License page.
 * This will be replaced with a real HTTP call to the external licensing service.
 */

export interface LicenseAddon {
	id: string;
	name: string;
	description: string;
	status: 'available' | 'purchased';
	action: 'purchase' | 'info';
	icon?: string;
	disabled?: boolean;
}

export interface LicenseAddonsResponse {
	addons: LicenseAddon[];
}

/**
 * Returns mocked add-on packages metadata.
 * TODO: Replace with real licensing service API call.
 */
export async function getLicenseAddons(): Promise<LicenseAddonsResponse> {
	return {
		addons: [
			{
				id: 'user_seats',
				name: 'User Seats',
				description: '$15.00 per seat',
				status: 'available',
				action: 'purchase',
				icon: 'group',
				disabled: false,
			},
			{
				id: 'sso',
				name: 'SSO Feature',
				description: 'Allows SSO configuration',
				status: 'available',
				action: 'purchase',
				icon: 'cloud_lock',
				disabled: false,
			},
			{
				id: 'collections',
				name: 'Data Model Collections',
				description: 'Additional collections',
				status: 'available',
				action: 'purchase',
				icon: 'inventory_2',
				disabled: true,
			},
			{
				id: 'basic_support',
				name: 'Basic Support',
				description: '',
				status: 'available',
				action: 'purchase',
				icon: 'support_agent',
				disabled: true,
			},
		],
	};
}

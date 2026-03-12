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
				id: 'sso',
				name: 'SSO Feature',
				description: 'Allows SSO configuration',
				status: 'available',
				action: 'purchase',
			},
			{
				id: 'user_seats',
				name: 'User Seats',
				description: 'Additional +1 user seat',
				status: 'available',
				action: 'purchase',
			},
			// {
			// 	id: 'collections',
			// 	name: 'Data Model Collections',
			// 	description: 'Additional +25 collections',
			// 	status: 'purchased',
			// 	action: 'info',
			// },
		],
	};
}

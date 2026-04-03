/**
 * Mock add-on metadata for the License page.
 * This will be replaced with a real HTTP call to the external licensing service.
 */

export interface LicenseAddon {
	id: string;
	quantity?: number; // numeric addons only (e.g. user_seats, collections)
}

export interface LicenseAddonsResponse {
	addons: LicenseAddon[];
}

/**
 * Returns purchased add-on IDs with optional quantity for numeric addons.
 * Boolean addons (e.g. sso) are represented by presence alone.
 * TODO: Replace with real licensing service API call.
 */
export async function getLicenseAddons(): Promise<LicenseAddonsResponse> {
	// Example of a list of no purchased add-ons
	// return { addons: [] };

	// Example of a list of purchased add-ons with quantities
	return {
		addons: [{ id: 'user_seats', quantity: 2 }, { id: 'collections', quantity: 1 }, { id: 'sso' }],
	};
}

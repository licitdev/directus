import type { Accountability, PermissionsAction } from '@directus/types';
import { uniq } from 'lodash-es';
import { AccessService } from '../../../services/access.js';
import { PermissionsService } from '../../../services/index.js';
import { fetchPolicies } from '../../lib/fetch-policies.js';

export interface fetchAllowedFieldsServices {
	accessService: AccessService;
	permissionsService: PermissionsService;
}

export interface FetchAllowedFieldsContext {
	accountability: Accountability;
}

export interface FetchAllowedFieldsOptions {
	collection: string;
	action: PermissionsAction;
}

/**
 * Look up all fields that are allowed to be used for the given collection and action for the given
 * accountability object
 *
 * Done by looking up all available policies for the current accountability object, and reading all
 * permissions that exist for the collection+action+policy combination
 */
export async function fetchAllowedFields(
	options: FetchAllowedFieldsOptions,
	context: FetchAllowedFieldsContext,
	services: fetchAllowedFieldsServices,
): Promise<string[]> {
	// TODO add cache

	const policies = await fetchPolicies(context.accountability, services.accessService);

	const permissions = (await services.permissionsService.readByQuery({
		fields: ['fields'],
		filter: {
			_and: [
				{ policy: { _in: policies } },
				{ collection: { _eq: options.collection } },
				{ action: { _eq: options.action } },
			],
		},
		limit: -1,
	})) as { fields: string[] | null }[];

	const allowedFields = [];

	for (const { fields } of permissions) {
		if (!fields) continue;
		allowedFields.push(...fields);
	}

	return uniq(allowedFields);
}

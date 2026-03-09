import type { AbstractServiceOptions, Query } from '@directus/types';
import { merge } from 'lodash-es';
import { Entitlements } from '../license/defaults.js';
import { getFeature } from '../license/lib/get-feature.js';
import { ItemsService } from './items.js';

export class ActivityService extends ItemsService {
	constructor(options: AbstractServiceOptions) {
		super('directus_activity', options);
	}

	override async readByQuery(query: Query): Promise<any> {
		const feature = await getFeature<{ limit: number }>(Entitlements.ACTIVITY_FEED);

		if (feature?.limit) {
			const cutoffISO = new Date(Date.now() - feature.limit * 24 * 60 * 60 * 1000).toISOString();

			const limitFilter: Query['filter'] = {
				timestamp: {
					_gt: cutoffISO,
				},
			};

			const combinedFilter: Query['filter'] = query.filter
				? {
						_and: [query.filter as any, limitFilter as any],
					}
				: limitFilter;

			const newQuery: Query = merge({}, query, { filter: combinedFilter });

			return super.readByQuery(newQuery);
		}

		return super.readByQuery(query);
	}
}

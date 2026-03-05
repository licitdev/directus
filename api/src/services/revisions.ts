import { Entitlements } from '@directus/constants';
import { ForbiddenError, InvalidPayloadError } from '@directus/errors';
import type { AbstractServiceOptions, Item, MutationOptions, PrimaryKey, Query } from '@directus/types';
import { merge } from 'lodash-es';
import { getFeature } from '../license/lib/get-feature.js';
import { ItemsService } from './items.js';

export class RevisionsService extends ItemsService {
	constructor(options: AbstractServiceOptions) {
		super('directus_revisions', options);
	}

	async revert(pk: PrimaryKey): Promise<void> {
		const revision = await super.readOne(pk);

		if (!revision) throw new ForbiddenError();

		if (!revision['data']) throw new InvalidPayloadError({ reason: `Revision doesn't contain data to revert to` });

		const service = new ItemsService(revision['collection'], {
			accountability: this.accountability,
			knex: this.knex,
			schema: this.schema,
		});

		await service.updateOne(revision['item'], revision['data']);
	}

	private setDefaultOptions(opts?: MutationOptions): MutationOptions {
		if (!opts) {
			return { autoPurgeCache: false, bypassLimits: true };
		}

		if (!('autoPurgeCache' in opts)) {
			opts.autoPurgeCache = false;
		}

		if (!('bypassLimits' in opts)) {
			opts.bypassLimits = true;
		}

		return opts;
	}

	override async createOne(data: Partial<Item>, opts?: MutationOptions): Promise<PrimaryKey> {
		return super.createOne(data, this.setDefaultOptions(opts));
	}

	override async createMany(data: Partial<Item>[], opts?: MutationOptions): Promise<PrimaryKey[]> {
		return super.createMany(data, this.setDefaultOptions(opts));
	}

	override async updateOne(key: PrimaryKey, data: Partial<Item>, opts?: MutationOptions): Promise<PrimaryKey> {
		return super.updateOne(key, data, this.setDefaultOptions(opts));
	}

	override async updateMany(keys: PrimaryKey[], data: Partial<Item>, opts?: MutationOptions): Promise<PrimaryKey[]> {
		return super.updateMany(keys, data, this.setDefaultOptions(opts));
	}

	override async readByQuery(query: Query): Promise<any> {
		const feature = await getFeature<{ limit: number }>(Entitlements.REVISIONS);

		if (feature?.limit) {
			const cutoffISO = new Date(Date.now() - feature.limit * 24 * 60 * 60 * 1000).toISOString();

			const limitFilter: Query['filter'] = {
				activity: {
					timestamp: {
						_gt: cutoffISO,
					},
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

import type {
	AbstractServiceOptions,
	Item,
	MutationOptions,
	OwnerInformation,
	PrimaryKey,
	Query,
	QueryOptions,
} from '@directus/types';
import { version } from 'directus/version';
import { getFeature } from '../license/index.js';
import { sendReport } from '../telemetry/index.js';
import { ItemsService } from './items.js';

export class SettingsService extends ItemsService {
	constructor(options: AbstractServiceOptions) {
		super('directus_settings', options);
	}

	override async upsertSingleton(data: Partial<Item>, opts?: MutationOptions): Promise<PrimaryKey> {
		await this.handleLLMFeatureGate(data);
		return super.upsertSingleton(data, opts);
	}

	override async readSingleton(query: Query, opts?: QueryOptions): Promise<Partial<Item>> {
		const data = await super.readSingleton(query, opts);
		await this.handleLLMFeatureGate(data);
		return data;
	}

	async setOwner(data: OwnerInformation) {
		const { project_id } = await this.knex.select('project_id').from('directus_settings').first();

		sendReport({ ...data, project_id, version }).catch(async () => {
			await this.knex.update('project_status', 'pending').from('directus_settings');
		});

		return await this.upsertSingleton({
			project_owner: data.project_owner,
			project_usage: data.project_usage,
			org_name: data.org_name,
			product_updates: data.product_updates,
			project_status: null,
		});
	}

	private async handleLLMFeatureGate(data: Partial<Item>): Promise<Partial<Item>> {
		const excludedFields = [
			'ai_openai_compatible_name',
			'ai_openai_compatible_base_url',
			'ai_openai_compatible_api_key',
			'ai_openai_compatible_headers',
			'ai_openai_compatible_models',
		];

		const llmFeature = await getFeature<{ enabled?: boolean }>('llm');

		if (!llmFeature?.enabled) {
			excludedFields.forEach((field) => {
				delete data[field];
			});
		}

		return data;
	}
}

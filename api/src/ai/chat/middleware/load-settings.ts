import type { RequestHandler } from 'express';
import { getFeature } from '../../../license/index.js';
import { SettingsService } from '../../../services/settings.js';
import { getSchema } from '../../../utils/get-schema.js';
import type { AISettings } from '../../providers/types.js';

const getFieldValue = <T>(value: T): T | null => {
	return value ?? null;
};

export const loadSettings: RequestHandler = async (_req, res, next) => {
	const service = new SettingsService({
		schema: await getSchema(),
	});

	const settings = await service.readSingleton({
		fields: [
			'ai_openai_api_key',
			'ai_anthropic_api_key',
			'ai_google_api_key',
			'ai_openai_compatible_api_key',
			'ai_openai_compatible_base_url',
			'ai_openai_compatible_name',
			'ai_openai_compatible_models',
			'ai_openai_compatible_headers',
			'ai_openai_allowed_models',
			'ai_anthropic_allowed_models',
			'ai_google_allowed_models',
			'ai_system_prompt',
		],
	});

	const llmFeature = await getFeature<{ enabled?: boolean }>('llm');
	const isLlmEnabled = llmFeature?.enabled ?? false;

	const aiSettings: AISettings = {
		openaiApiKey: getFieldValue(settings['ai_openai_api_key']),
		anthropicApiKey: getFieldValue(settings['ai_anthropic_api_key']),
		googleApiKey: getFieldValue(settings['ai_google_api_key']),
		openaiCompatibleApiKey: isLlmEnabled ? getFieldValue(settings['ai_openai_compatible_api_key']) : null,
		openaiCompatibleBaseUrl: isLlmEnabled ? getFieldValue(settings['ai_openai_compatible_base_url']) : null,
		openaiCompatibleName: isLlmEnabled ? getFieldValue(settings['ai_openai_compatible_name']) : null,
		openaiCompatibleModels: isLlmEnabled ? getFieldValue(settings['ai_openai_compatible_models']) : null,
		openaiCompatibleHeaders: isLlmEnabled ? getFieldValue(settings['ai_openai_compatible_headers']) : null,
		openaiAllowedModels: getFieldValue(settings['ai_openai_allowed_models']),
		anthropicAllowedModels: getFieldValue(settings['ai_anthropic_allowed_models']),
		googleAllowedModels: getFieldValue(settings['ai_google_allowed_models']),
		systemPrompt: getFieldValue(settings['ai_system_prompt']),
	};

	res.locals['ai'] = {
		settings: aiSettings,
		systemPrompt: settings['ai_system_prompt'],
	};

	return next();
};

import { ErrorCode, isDirectusError } from '@directus/errors';
import express from 'express';
import { handleLicenseApiError } from '../license/lib/handle-api-error.js';
import { resolvePublicUrl } from '../license/lib/license-context.js';
import { validate } from '../license/lib/validate.js';
import { respond } from '../middleware/respond.js';
import useCollection from '../middleware/use-collection.js';
import { SettingsService } from '../services/index.js';
import asyncHandler from '../utils/async-handler.js';
import { clearCacheTokenPayload } from '../utils/cache-token-payload.js';

const router = express.Router();

router.use(useCollection('directus_settings'));

router.get(
	'/',
	asyncHandler(async (req, res, next) => {
		const service = new SettingsService({
			accountability: req.accountability,
			schema: req.schema,
		});

		const records = await service.readSingleton(req.sanitizedQuery);
		res.locals['payload'] = { data: records || null };
		return next();
	}),
	respond,
);

router.post(
	'/owner',
	asyncHandler(async (req, _res, next) => {
		const service = new SettingsService({
			accountability: req.accountability,
			schema: req.schema,
		});

		await service.setOwner(req.body);

		return next();
	}),
	respond,
);

router.patch(
	'/',
	asyncHandler(async (req, res, next) => {
		const service = new SettingsService({
			accountability: req.accountability,
			schema: req.schema,
		});

		const body = { ...req.body };
		const trimmedLicenseKey = typeof body.license_key === 'string' ? body.license_key.trim() : null;

		if (trimmedLicenseKey) {
			try {
				const settings = (await service.readSingleton({ fields: ['project_id'] })) as {
					project_id?: string;
				};

				const { token, projectId: newProjectId } = await validate({
					licenseKey: trimmedLicenseKey,
					...(settings?.project_id && { projectId: settings.project_id }),
					publicUrl: resolvePublicUrl(),
				});

				body.license_key = trimmedLicenseKey;
				body.license_token = token;

				if (newProjectId) {
					body.project_id = newProjectId;
				}

				await clearCacheTokenPayload();
			} catch (error) {
				handleLicenseApiError(error);
			}
		} else if (body.license_key === '' || body.license_key === null) {
			body.license_key = null;
			body.license_token = null;
			await clearCacheTokenPayload();
		}

		await service.upsertSingleton(body);

		try {
			const record = await service.readSingleton(req.sanitizedQuery);
			res.locals['payload'] = { data: record || null };
		} catch (error: any) {
			if (isDirectusError(error, ErrorCode.Forbidden)) {
				return next();
			}

			throw error;
		}

		return next();
	}),
	respond,
);

export default router;

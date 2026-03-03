import { ErrorCode, isDirectusError } from '@directus/errors';
import express from 'express';
import { isNull } from 'lodash-es';
import { deactivate, getKey, validate } from '../license/index.js';
import { respond } from '../middleware/respond.js';
import useCollection from '../middleware/use-collection.js';
import { SettingsService } from '../services/settings.js';
import asyncHandler from '../utils/async-handler.js';
import { deleteCacheTokenPayload, writeCacheTokenPayload } from '../utils/cache-token-payload.js';
import { verify } from '../utils/verify-token.js';

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

		const licenseKey = req.body.license_key;

		if (licenseKey && typeof licenseKey === 'string') {
			const { token, projectId } = await validate({ licenseKey });
			const payload = await verify(token);
			await writeCacheTokenPayload(payload);
			req.body.license_token = token;

			if (projectId) {
				req.body.project_id = projectId;
			}
		} else if (isNull(licenseKey)) {
			const currentLicenseKey = await getKey();

			if (currentLicenseKey) {
				await deactivate({ licenseKey: currentLicenseKey });
			}

			req.body.license_token = null;
			await deleteCacheTokenPayload();
		}

		await service.upsertSingleton(req.body);

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

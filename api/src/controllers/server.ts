import { useEnv } from '@directus/env';
import { ErrorCode, ForbiddenError, InvalidPayloadError, isDirectusError, RouteNotFoundError } from '@directus/errors';
import { format } from 'date-fns';
import { Router } from 'express';
import { checkLicense } from '../license/lib/check-license.js';
import { deactivate } from '../license/lib/deactivate.js';
import { getKey } from '../license/lib/get-key.js';
import { resolvePublicUrl } from '../license/lib/license-context.js';
import { validateAndGetToken } from '../license/lib/validate-and-get-token.js';
import { useLogger } from '../logger/index.js';
import { respond } from '../middleware/respond.js';
import { SettingsService } from '../services/index.js';
import { ServerService } from '../services/server.js';
import { SpecificationService } from '../services/specifications.js';
import asyncHandler from '../utils/async-handler.js';
import { clearCacheTokenPayload } from '../utils/cache-token-payload.js';
import { createAdmin } from '../utils/create-admin.js';
import { getProjectId } from '../utils/get-project-id.js';
import { verify } from '../utils/verify-token.js';

const router = Router();

router.get(
	'/specs/oas',
	asyncHandler(async (req, res, next) => {
		const service = new SpecificationService({
			accountability: req.accountability,
			schema: req.schema,
		});

		res.locals['payload'] = await service.oas.generate(req.headers.host);
		return next();
	}),
	respond,
);

router.get(
	'/specs/graphql/:scope?',
	asyncHandler(async (req, res) => {
		const service = new SpecificationService({
			accountability: req.accountability,
			schema: req.schema,
		});

		const serverService = new ServerService({
			accountability: req.accountability,
			schema: req.schema,
		});

		const scope = req.params['scope'] || 'items';

		if (['items', 'system'].includes(scope) === false) throw new RouteNotFoundError({ path: req.path });

		const info = await serverService.serverInfo();
		const result = await service.graphql.generate(scope as 'items' | 'system');
		const filename = info['project'].project_name + '_' + format(new Date(), 'yyyy-MM-dd') + '.graphql';

		res.attachment(filename);
		res.send(result);
	}),
);

router.get(
	'/info',
	asyncHandler(async (req, res, next) => {
		const service = new ServerService({
			accountability: req.accountability,
			schema: req.schema,
		});

		const data = await service.serverInfo();
		res.locals['payload'] = { data };
		return next();
	}),
	respond,
);

router.get(
	'/health',
	asyncHandler(async (req, res, next) => {
		const service = new ServerService({
			accountability: req.accountability,
			schema: req.schema,
		});

		const data = await service.health();

		res.setHeader('Content-Type', 'application/health+json');

		if (data['status'] === 'error') res.status(503);
		res.locals['payload'] = data;
		res.locals['cache'] = false;
		return next();
	}),
	respond,
);

router.post(
	'/setup',
	asyncHandler(async (req, _res, next) => {
		const serverService = new ServerService({ schema: req.schema });

		if (await serverService.isSetupCompleted()) {
			throw new ForbiddenError();
		}

		const settingsService = new SettingsService({ schema: req.schema });
		const logger = useLogger();
		let licenseToken: string | null = null;

		const licenseKey = req.body.license_key;
		const trimmedLicenseKey = typeof licenseKey === 'string' ? licenseKey.trim() : null;

		if (trimmedLicenseKey) {
			try {
				const settings = (await settingsService.readSingleton({ fields: ['project_id'] })) as {
					project_id?: string;
				};

				licenseToken = await validateAndGetToken(trimmedLicenseKey, {
					...(settings?.project_id && { projectId: settings.project_id }),
					publicUrl: resolvePublicUrl(),
				});
			} catch (err) {
				logger.warn({ err }, 'License key validation failed during setup — proceeding without license.');
			}
		}

		try {
			await createAdmin(req.schema, {
				email: req.body.project_owner,
				password: req.body.password,
				first_name: req.body.first_name,
				last_name: req.body.last_name,
			});

			await settingsService.setOwner(req.body);

			if (licenseToken !== null) {
				await settingsService.upsertSingleton({
					license_key: trimmedLicenseKey,
					license_token: licenseToken,
				});
			}
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

router.post(
	'/validate-license',
	asyncHandler(async (req, res, next) => {
		const licenseKey = typeof req.body.license_key === 'string' ? req.body.license_key.trim() : null;

		if (!licenseKey) {
			throw new InvalidPayloadError({ reason: 'license_key is required' });
		}

		let publicUrl: string;

		try {
			publicUrl = resolvePublicUrl();
		} catch {
			throw new InvalidPayloadError({ reason: 'PUBLIC_URL is not configured on this server' });
		}

		const settingsService = new SettingsService({ schema: req.schema });
		const settings = (await settingsService.readSingleton({ fields: ['project_id'] })) as { project_id?: string };

		const token = await validateAndGetToken(licenseKey, {
			...(settings?.project_id && { projectId: settings.project_id }),
			publicUrl,
		});

		const payload = await verify(token);

		res.locals['payload'] = { data: payload };
		return next();
	}),
	respond,
);

router.post(
	'/check-license',
	asyncHandler(async (req, res, next) => {
		const licenseKey = typeof req.body.license_key === 'string' ? req.body.license_key.trim() : null;

		const payload = await checkLicense({ licenseKey });

		res.locals['payload'] = { data: payload };
		return next();
	}),
	respond,
);

router.post(
	'/deactivate-license',
	asyncHandler(async (req, res, next) => {
		const env = useEnv();

		const hasEnvLicenseKey =
			typeof env['DIRECTUS_LICENSE_KEY'] === 'string' && String(env['DIRECTUS_LICENSE_KEY']).trim() !== '';

		if (hasEnvLicenseKey) {
			throw new InvalidPayloadError({
				reason: 'Cannot deactivate license managed via environment variable',
			});
		}

		const licenseKey = await getKey();

		if (!licenseKey) {
			throw new InvalidPayloadError({ reason: 'No license key configured' });
		}

		const projectId = await getProjectId();

		if (!projectId) {
			throw new InvalidPayloadError({ reason: 'Project ID is not configured' });
		}

		await deactivate({ licenseKey, projectId });

		const settingsService = new SettingsService({ schema: req.schema });

		await settingsService.upsertSingleton({
			license_key: null,
			license_token: null,
		});

		await clearCacheTokenPayload();

		res.locals['payload'] = { data: { success: true } };
		return next();
	}),
	respond,
);

export default router;

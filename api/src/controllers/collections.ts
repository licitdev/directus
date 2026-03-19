import { ErrorCode, isDirectusError, LimitExceededError } from '@directus/errors';
import type { Item } from '@directus/types';
import { Router } from 'express';
import { isNil } from 'lodash-es';
import { respond } from '../middleware/respond.js';
import { validateBatch } from '../middleware/validate-batch.js';
import { CollectionsService } from '../services/collections.js';
import { MetaService } from '../services/meta.js';
import asyncHandler from '../utils/async-handler.js';

const router = Router();

router.post(
	'/',
	asyncHandler(async (req, res, next) => {
		const collectionsService = new CollectionsService({
			accountability: req.accountability,
			schema: req.schema,
		});

		const attemptConcurrentIndex =
			'concurrentIndexCreation' in req.query && req.query['concurrentIndexCreation'] !== 'false';

		const newCollectionsCount = Array.isArray(req.body) ? req.body.length : 1;
		const isWithinLimit = await collectionsService.checkAddingLimit(newCollectionsCount);

		if (!isWithinLimit) {
			throw new LimitExceededError({ category: 'collections' });
		}

		if (Array.isArray(req.body)) {
			const collectionKey = await collectionsService.createMany(req.body, {
				attemptConcurrentIndex,
			});

			const records = await collectionsService.readMany(collectionKey);
			res.locals['payload'] = { data: records || null };
		} else {
			const collectionKey = await collectionsService.createOne(req.body, {
				attemptConcurrentIndex,
			});

			const record = await collectionsService.readOne(collectionKey);
			res.locals['payload'] = { data: record || null };
		}

		return next();
	}),
	respond,
);

const readHandler = asyncHandler(async (req, res, next) => {
	const collectionsService = new CollectionsService({
		accountability: req.accountability,
		schema: req.schema,
	});

	const metaService = new MetaService({
		accountability: req.accountability,
		schema: req.schema,
	});

	let result: Item[] = [];

	if (req.body.keys) {
		result = await collectionsService.readMany(req.body.keys);
	} else {
		result = await collectionsService.readByQuery();
	}

	const meta = await metaService.getMetaForQuery('directus_collections', {});

	res.locals['payload'] = { data: result, meta };
	return next();
});

router.get('/', validateBatch('read'), readHandler, respond);
router.search('/', validateBatch('read'), readHandler, respond);

router.get(
	'/:collection',
	asyncHandler(async (req, res, next) => {
		const collectionsService = new CollectionsService({
			accountability: req.accountability,
			schema: req.schema,
		});

		const collection = await collectionsService.readOne(req.params['collection']!);
		res.locals['payload'] = { data: collection || null };

		return next();
	}),
	respond,
);

router.patch(
	'/',
	asyncHandler(async (req, res, next) => {
		const collectionsService = new CollectionsService({
			accountability: req.accountability,
			schema: req.schema,
		});

		let newAdded = 0;
		let newExcluded = 0;

		for (const collection of req.body) {
			if (!isNil(collection.meta)) {
				const isExisted = await collectionsService.isExisted(collection.collection);

				if (!isExisted) {
					newAdded++;
				}
			}

			const isCurrentlyExcluded = await collectionsService.isExcluded(collection.collection!);

			if (!collection.meta?.excluded && isCurrentlyExcluded) {
				newAdded++;
			}

			if (collection.meta?.excluded && !isCurrentlyExcluded) {
				newExcluded++;
			}
		}

		const newCount = newAdded - newExcluded;

		if (newCount > 0) {
			const isWithinLimit = await collectionsService.checkAddingLimit(newCount);

			if (!isWithinLimit) {
				throw new LimitExceededError({ category: 'collections' });
			}
		}

		const collectionKeys = await collectionsService.updateBatch(req.body);

		try {
			const collections = await collectionsService.readMany(collectionKeys);
			res.locals['payload'] = { data: collections || null };
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

router.patch(
	'/:collection',
	asyncHandler(async (req, res, next) => {
		const collectionsService = new CollectionsService({
			accountability: req.accountability,
			schema: req.schema,
		});

		let checkLimitForDbOnlyCollection = false;
		const meta = req.body?.meta;

		if (!isNil(meta)) {
			const isExisted = await collectionsService.isExisted(req.params['collection']!);
			checkLimitForDbOnlyCollection = !isExisted;
		}

		let checkLimitForExcludedCollection = false;
		const excluded = meta?.excluded;

		if (!excluded) {
			const isCurrentlyExcluded = await collectionsService.isExcluded(req.params['collection']!);
			checkLimitForExcludedCollection = !!isCurrentlyExcluded;
		}

		const shouldCheckLimit = checkLimitForDbOnlyCollection || checkLimitForExcludedCollection;

		if (shouldCheckLimit) {
			const isWithinLimit = await collectionsService.checkAddingLimit(1);

			if (!isWithinLimit) {
				throw new LimitExceededError({ category: 'collections' });
			}
		}

		await collectionsService.updateOne(req.params['collection']!, req.body);

		try {
			const collection = await collectionsService.readOne(req.params['collection']!);
			res.locals['payload'] = { data: collection || null };
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

router.delete(
	'/:collection',
	asyncHandler(async (req, _res, next) => {
		const collectionsService = new CollectionsService({
			accountability: req.accountability,
			schema: req.schema,
		});

		await collectionsService.deleteOne(req.params['collection']!);

		return next();
	}),
	respond,
);

export default router;

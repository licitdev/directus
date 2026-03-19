import type { RequestHandler } from 'express';
import { createCollectionExcludedError } from '../permissions/modules/process-ast/utils/validate-path/create-error.js';
import { CollectionsService } from '../services/collections.js';
import asyncHandler from '../utils/async-handler.js';

/**
 * Check if requested collection is marked as excluded.
 * If so, throw the standard collection forbidden error.
 */
const collectionExcluded: RequestHandler = asyncHandler(async (req, _res, next) => {
	if (!req.params['collection']) return next();

	const collectionsService = new CollectionsService({
		accountability: req.accountability,
		schema: req.schema,
	});

	const isExcluded = await collectionsService.isExcluded(req.params['collection']!);

	if (isExcluded) {
		throw createCollectionExcludedError('', req.params['collection']!);
	}

	return next();
});

export default collectionExcluded;

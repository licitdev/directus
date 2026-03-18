import type { Accountability, SchemaOverview } from '@directus/types';
import type { Request, Response } from 'express';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { createCollectionExcludedError } from '../permissions/modules/process-ast/utils/validate-path/create-error.js';
import { CollectionsService } from '../services/collections.js';
import collectionExcluded from './collection-excluded.js';

vi.mock('../services/collections.js', () => {
	const CollectionsService = vi.fn();
	CollectionsService.prototype.isExcluded = vi.fn().mockResolvedValue(false);
	return { CollectionsService };
});

type CollectionExcludedError = Error & { code?: string };

vi.mock('../permissions/modules/process-ast/utils/validate-path/create-error.js', () => ({
	createCollectionExcludedError: vi.fn().mockImplementation((_path: string, collection: string) => {
		const error: CollectionExcludedError = new Error(`Collection "${collection}" is excluded`);
		error.code = 'FORBIDDEN';
		return error;
	}),
}));

describe('collectionExcluded middleware', () => {
	let req: Request;
	let res: Response;
	let next: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		req = {
			params: {},
			accountability: undefined,
			schema: {} as unknown as SchemaOverview,
		} as unknown as Request;

		res = {} as Response;
		next = vi.fn();

		vi.clearAllMocks();
	});

	test('calls next immediately when no collection param is present', async () => {
		await collectionExcluded(req, res, next);

		expect(CollectionsService).not.toHaveBeenCalled();
		expect(next).toHaveBeenCalledTimes(1);
		expect(next).toHaveBeenCalledWith();
	});

	test('creates CollectionsService with accountability and schema from request', async () => {
		req.params['collection'] = 'articles';
		req.accountability = { user: '1' } as Accountability;
		req.schema = { collections: {}, fields: {}, relations: {} } as unknown as SchemaOverview;

		await collectionExcluded(req, res, next);

		expect(CollectionsService).toHaveBeenCalledWith({
			accountability: req.accountability,
			schema: req.schema,
		});
	});

	test('calls next when collection is not excluded', async () => {
		req.params['collection'] = 'articles';

		const isExcludedSpy = vi.spyOn(CollectionsService.prototype, 'isExcluded').mockResolvedValueOnce(false);

		await collectionExcluded(req, res, next);

		expect(isExcludedSpy).toHaveBeenCalledWith('articles');
		expect(next).toHaveBeenCalledTimes(1);
		expect(next).toHaveBeenCalledWith();
	});

	test('calls next with collection excluded error when collection is excluded', async () => {
		req.params['collection'] = 'articles';

		vi.spyOn(CollectionsService.prototype, 'isExcluded').mockResolvedValueOnce(true);

		const expectedError = createCollectionExcludedError('', 'articles');

		await collectionExcluded(req, res, next);

		expect(CollectionsService.prototype.isExcluded).toHaveBeenCalledWith('articles');
		expect(next).toHaveBeenCalledTimes(1);
		expect(next).toHaveBeenCalledWith(expectedError);
	});
});

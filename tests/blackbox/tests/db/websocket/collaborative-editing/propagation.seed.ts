import { CreateCollection, CreateField, DeleteCollection } from '@common/functions';
import vendors from '@common/get-dbs-to-test';
import { expect, it } from 'vitest';

export const collectionCollabPropagation = 'test_collab_propagation';

export const seedDBStructure = () => {
	it.each(vendors)('%s', async (vendor) => {
		try {
			// Delete existing collections
			await DeleteCollection(vendor, { collection: collectionCollabPropagation });

			// Create collection
			await CreateCollection(vendor, { collection: collectionCollabPropagation, primaryKeyType: 'uuid' });

			// Create fields
			await CreateField(vendor, { collection: collectionCollabPropagation, field: 'title', type: 'string' });
			await CreateField(vendor, { collection: collectionCollabPropagation, field: 'content', type: 'text' });

			expect(true).toBeTruthy();
		} catch (error) {
			expect(error).toBeFalsy();
		}
	});
};

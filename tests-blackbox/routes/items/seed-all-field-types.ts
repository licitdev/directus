import { CreateField, CreateItem, SeedFunctions, PrimaryKeyType } from '@common/index';
import { TestsFieldSchema } from '@query/filter';

export function getTestsAllTypesSchema(): TestsFieldSchema {
	const fieldSchema: TestsFieldSchema = {};

	for (const key of Object.keys(SeedFunctions.generateValues)) {
		const field = `test_${key.toLowerCase()}`;
		fieldSchema[field] = {
			field: field,
			type: key,
			filters: true,
			possibleValues: SeedFunctions.generateValues[key as keyof typeof SeedFunctions.generateValues]({ quantity: 2 }),
		};
	}

	return fieldSchema;
}

export const seedAllFieldTypesStructure = async (vendor: string, collection: string) => {
	try {
		const fieldSchema = getTestsAllTypesSchema();

		// Create fields
		for (const key of Object.keys(fieldSchema)) {
			await CreateField(vendor, {
				collection: collection,
				field: fieldSchema[key].field.toLowerCase(),
				type: fieldSchema[key].type,
			});
		}

		expect(true).toBeTruthy();
	} catch (error) {
		expect(error).toBeFalsy();
	}
};

export const seedAllFieldTypesValues = async (vendor: string, collection: string, pkType: PrimaryKeyType) => {
	try {
		const fieldSchema = getTestsAllTypesSchema();

		// Create items
		let generatedStringIdCounter = 0;
		for (const key of Object.keys(fieldSchema)) {
			const items = [];
			const castValueToString = ['bigInteger'].includes(fieldSchema[key].type);

			if (pkType === 'string') {
				for (let i = 0; i < fieldSchema[key].possibleValues.length; i++) {
					items.push({
						id: SeedFunctions.generateValues.string({
							quantity: 1,
							seed: `id-${generatedStringIdCounter}`,
						})[0],
						[fieldSchema[key].field]: castValueToString
							? String(fieldSchema[key].possibleValues[i])
							: fieldSchema[key].possibleValues[i],
					});
					generatedStringIdCounter++;
				}
			} else {
				for (const value of fieldSchema[key].possibleValues) {
					items.push({
						[fieldSchema[key].field]: castValueToString ? String(value) : value,
					});
				}
			}

			await CreateItem(vendor, {
				collection: collection,
				item: items,
			});
		}

		expect(true).toBeTruthy();
	} catch (error) {
		expect(error).toBeFalsy();
	}
};

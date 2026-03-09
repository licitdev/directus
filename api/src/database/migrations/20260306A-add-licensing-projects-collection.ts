import type { Knex } from 'knex';

/**
 * Creates the `projects` collection required by the licensing service.
 * The licensing service queries this collection to validate project_id from directus_settings.
 * This migration creates the table, registers it in Directus schema, and seeds the initial
 * project record from current directus_settings (project_id, project_name, project_url).
 */
export async function up(knex: Knex): Promise<void> {
	const hasProjectsTable = await knex.schema.hasTable('projects');

	if (hasProjectsTable) {
		return;
	}

	// 1. Create projects table
	await knex.schema.createTable('projects', (table) => {
		table.uuid('id').primary().notNullable();
		table.string('name', 255).notNullable();
		table.string('public_url', 2048).nullable();
	});

	// 2. Register collection in directus_collections
	await knex('directus_collections').insert({
		collection: 'projects',
		icon: 'business',
		note: 'Project registry for licensing service',
		hidden: true,
	});

	// 3. Register fields in directus_fields
	await knex('directus_fields').insert([
		{
			collection: 'projects',
			field: 'id',
			special: 'uuid',
			interface: 'input',
			required: true,
			sort: 1,
			width: 'full',
		},
		{
			collection: 'projects',
			field: 'name',
			interface: 'input',
			sort: 2,
			width: 'full',
		},
		{
			collection: 'projects',
			field: 'public_url',
			interface: 'input',
			sort: 3,
			width: 'full',
		},
	]);

	// 4. Seed project record from directus_settings
	const settings = await knex('directus_settings').select('project_id', 'project_name', 'project_url').first();

	if (settings?.project_id) {
		const projectName =
			typeof settings.project_name === 'string' && settings.project_name.trim()
				? settings.project_name.trim()
				: 'Directus Project';

		const publicUrl =
			typeof settings.project_url === 'string' && settings.project_url.trim() ? settings.project_url.trim() : null;

		await knex('projects').insert({
			id: settings.project_id,
			name: projectName,
			public_url: publicUrl,
		});
	}
}

export async function down(knex: Knex): Promise<void> {
	await knex('directus_fields').where('collection', 'projects').delete();
	await knex('directus_collections').where('collection', 'projects').delete();
	await knex.schema.dropTableIfExists('projects');
}

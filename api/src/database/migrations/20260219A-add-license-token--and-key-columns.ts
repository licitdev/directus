import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
	await knex.schema.alterTable('directus_settings', (table) => {
		table.text('license_token').defaultTo(null).nullable();
		table.text('license_key').defaultTo(null).nullable();
	});
}

export async function down(knex: Knex): Promise<void> {
	await knex.schema.alterTable('directus_settings', (table) => {
		table.dropColumn('license_token');
		table.dropColumn('license_key');
	});
}

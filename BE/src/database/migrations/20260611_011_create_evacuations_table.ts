import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('evacuations', (table) => {
    table.text('id').primary();
    table.text('incident_id').notNullable().references('id').inTable('incidents');
    table
      .text('initiated_by')
      .notNullable()
      .references('id')
      .inTable('users');
    table.text('zone_id').notNullable().references('id').inTable('zones');
    table.text('started_at').notNullable();
    table.text('completed_at').nullable();
    table.text('notes').nullable();
    table.text('created_at');
    table.text('updated_at');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('evacuations');
}

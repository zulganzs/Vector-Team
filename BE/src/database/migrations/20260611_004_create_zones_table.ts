import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('zones', (table) => {
    table.text('id').primary();
    table
      .text('building_id')
      .notNullable()
      .references('id')
      .inTable('buildings')
      .onDelete('CASCADE');
    table.text('name').notNullable();
    table.text('description').nullable();
    table.text('floor').nullable();
    table.text('created_at');
    table.text('updated_at');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('zones');
}

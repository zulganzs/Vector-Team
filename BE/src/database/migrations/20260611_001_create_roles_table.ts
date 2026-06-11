import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('roles', (table) => {
    table.text('id').primary();
    table
      .text('name')
      .unique()
      .notNullable()
      .checkIn(['admin', 'building_manager', 'firefighter']);
    table.text('created_at');
    table.text('updated_at');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('roles');
}

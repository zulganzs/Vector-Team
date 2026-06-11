import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('buildings', (table) => {
    table.text('id').primary();
    table.text('name').notNullable();
    table.text('address').notNullable();
    table.text('description').nullable();
    table.text('created_at');
    table.text('updated_at');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('buildings');
}

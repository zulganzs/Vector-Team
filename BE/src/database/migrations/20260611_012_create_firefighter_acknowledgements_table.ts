import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('firefighter_acknowledgements', (table) => {
    table.text('id').primary();
    table
      .text('incident_id')
      .notNullable()
      .references('id')
      .inTable('incidents');
    table.text('user_id').notNullable().references('id').inTable('users');
    table.text('acknowledged_at').notNullable();
    table.text('notes').nullable();
    table.text('created_at');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('firefighter_acknowledgements');
}

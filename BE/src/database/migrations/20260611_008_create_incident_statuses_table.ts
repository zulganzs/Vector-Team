import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('incident_statuses', (table) => {
    table.text('id').primary();
    table
      .text('incident_id')
      .notNullable()
      .references('id')
      .inTable('incidents')
      .onDelete('CASCADE');
    table.text('from_status').nullable();
    table.text('to_status').notNullable();
    // actor_id is nullable — system-generated transitions have no actor
    table.text('actor_id').nullable().references('id').inTable('users');
    table.text('reason').nullable();
    table.text('created_at');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('incident_statuses');
}

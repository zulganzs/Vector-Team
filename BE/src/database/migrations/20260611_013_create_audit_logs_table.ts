import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('audit_logs', (table) => {
    table.text('id').primary();
    table.text('user_id').nullable().references('id').inTable('users');
    table.text('action').notNullable();
    table.text('entity_type').notNullable();
    table.text('entity_id').nullable();
    table.text('old_values').nullable(); // JSON stringified
    table.text('new_values').nullable(); // JSON stringified
    table.text('ip_address').nullable();
    table.text('user_agent').nullable();
    table.text('created_at');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('audit_logs');
}

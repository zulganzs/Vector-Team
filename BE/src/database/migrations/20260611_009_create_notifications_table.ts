import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('notifications', (table) => {
    table.text('id').primary();
    table.text('incident_id').notNullable().references('id').inTable('incidents');
    table.text('type').notNullable();
    table.text('recipient_phone').nullable();
    table.text('message').notNullable();
    table.text('status').notNullable().defaultTo('pending');
    table.integer('retry_count').defaultTo(0);
    table.text('sent_at').nullable();
    table.text('created_at');
    table.text('updated_at');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('notifications');
}

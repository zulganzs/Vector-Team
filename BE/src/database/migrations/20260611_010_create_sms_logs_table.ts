import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('sms_logs', (table) => {
    table.text('id').primary();
    table
      .text('notification_id')
      .notNullable()
      .references('id')
      .inTable('notifications');
    table.text('twilio_sid').nullable();
    table.text('status').notNullable();
    table.integer('attempt_number').notNullable();
    table.text('error_message').nullable();
    table.text('created_at');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('sms_logs');
}

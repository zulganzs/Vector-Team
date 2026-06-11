import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('sensors', (table) => {
    table.text('id').primary();
    table
      .text('zone_id')
      .notNullable()
      .references('id')
      .inTable('zones')
      .onDelete('CASCADE');
    table.text('sensor_code').unique().notNullable();
    table.text('name').notNullable();
    table.text('type').notNullable();
    table.text('status').notNullable().defaultTo('unknown');
    table.text('last_seen_at').nullable();
    table.integer('is_active').defaultTo(1);
    table.text('created_at');
    table.text('updated_at');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('sensors');
}

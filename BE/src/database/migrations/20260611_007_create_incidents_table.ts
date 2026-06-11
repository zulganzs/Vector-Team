import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('incidents', (table) => {
    table.text('id').primary();
    table.text('sensor_id').notNullable().references('id').inTable('sensors');
    table.text('zone_id').notNullable().references('id').inTable('zones');
    table.text('building_id').notNullable().references('id').inTable('buildings');
    table.text('status').notNullable();
    table.text('severity').notNullable();
    table.float('smoke_value').notNullable();
    table.float('water_flow').nullable();
    table.text('notes').nullable();
    table.text('detected_at').notNullable();
    table.text('acknowledged_at').nullable();
    table.text('resolved_at').nullable();
    table.text('closed_at').nullable();
    table.text('dismissed_at').nullable();
    table.text('created_at');
    table.text('updated_at');
  });

  // Index for active-per-sensor queries
  await knex.schema.raw(
    'CREATE INDEX incidents_sensor_id_status_idx ON incidents (sensor_id, status)',
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.raw('DROP INDEX IF EXISTS incidents_sensor_id_status_idx');
  await knex.schema.dropTableIfExists('incidents');
}

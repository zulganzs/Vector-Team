import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('sensor_readings', (table) => {
    table.text('id').primary();
    table
      .text('sensor_id')
      .notNullable()
      .references('id')
      .inTable('sensors')
      .onDelete('CASCADE');
    // Denormalized zone_id for query performance (avoids JOIN to sensors)
    table
      .text('zone_id')
      .notNullable()
      .references('id')
      .inTable('zones')
      .onDelete('CASCADE');
    table.integer('smoke_value').notNullable();
    table.float('water_flow').nullable();
    table.text('classification').notNullable();
    table.integer('is_duplicate').defaultTo(0);
    table.text('sensor_timestamp').notNullable();
    table.text('received_at').notNullable();
    table.text('created_at');
  });

  // Index for efficient per-sensor chronological queries
  await knex.schema.raw(
    'CREATE INDEX sensor_readings_sensor_id_received_at_idx ON sensor_readings (sensor_id, received_at DESC)',
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.raw(
    'DROP INDEX IF EXISTS sensor_readings_sensor_id_received_at_idx',
  );
  await knex.schema.dropTableIfExists('sensor_readings');
}

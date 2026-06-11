import type { Knex } from 'knex';
import { randomUUID } from 'crypto';

export async function seed(knex: Knex): Promise<void> {
  // Clean existing data (respects FK order — truncate child tables first)
  await knex('audit_logs').del();
  await knex('firefighter_acknowledgements').del();
  await knex('evacuations').del();
  await knex('sms_logs').del();
  await knex('notifications').del();
  await knex('incident_statuses').del();
  await knex('incidents').del();
  await knex('sensor_readings').del();
  await knex('sensors').del();
  await knex('zones').del();
  await knex('buildings').del();
  await knex('users').del();
  await knex('roles').del();

  const now = new Date().toISOString();

  await knex('roles').insert([
    { id: randomUUID(), name: 'admin', created_at: now, updated_at: now },
    { id: randomUUID(), name: 'building_manager', created_at: now, updated_at: now },
    { id: randomUUID(), name: 'firefighter', created_at: now, updated_at: now },
  ]);
}

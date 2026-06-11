import type { Knex } from 'knex';
import { randomUUID } from 'crypto';

export async function seed(knex: Knex): Promise<void> {
  const now = new Date().toISOString();

  // 1 Building
  const buildingId = randomUUID();
  await knex('buildings').insert({
    id: buildingId,
    name: 'Gedung A',
    address: 'Jl. Sudirman No.1',
    description: null,
    created_at: now,
    updated_at: now,
  });

  // 2 Zones in that building
  const zone1Id = randomUUID();
  const zone2Id = randomUUID();
  await knex('zones').insert([
    {
      id: zone1Id,
      building_id: buildingId,
      name: 'Lantai 1',
      description: null,
      floor: '1',
      created_at: now,
      updated_at: now,
    },
    {
      id: zone2Id,
      building_id: buildingId,
      name: 'Lantai 2',
      description: null,
      floor: '2',
      created_at: now,
      updated_at: now,
    },
  ]);

  // 3 Sensors — 2 in zone 1, 1 in zone 2
  await knex('sensors').insert([
    {
      id: randomUUID(),
      zone_id: zone1Id,
      sensor_code: 'SENSOR-001',
      name: 'Sensor Lantai 1 - A',
      type: 'combined',
      status: 'unknown',
      last_seen_at: null,
      is_active: 1,
      created_at: now,
      updated_at: now,
    },
    {
      id: randomUUID(),
      zone_id: zone1Id,
      sensor_code: 'SENSOR-002',
      name: 'Sensor Lantai 1 - B',
      type: 'combined',
      status: 'unknown',
      last_seen_at: null,
      is_active: 1,
      created_at: now,
      updated_at: now,
    },
    {
      id: randomUUID(),
      zone_id: zone2Id,
      sensor_code: 'SENSOR-003',
      name: 'Sensor Lantai 2 - A',
      type: 'combined',
      status: 'unknown',
      last_seen_at: null,
      is_active: 1,
      created_at: now,
      updated_at: now,
    },
  ]);
}

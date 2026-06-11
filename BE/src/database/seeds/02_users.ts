import type { Knex } from 'knex';
import { randomUUID } from 'crypto';
import bcrypt from 'bcrypt';

const BCRYPT_COST = 12;

export async function seed(knex: Knex): Promise<void> {
  const now = new Date().toISOString();

  // Fetch roles inserted by 01_roles seed
  const roles = await knex('roles').select('id', 'name');
  const roleMap: Record<string, string> = {};
  for (const role of roles) {
    roleMap[role.name as string] = role.id as string;
  }

  const [adminHash, managerHash, firefighterHash] = await Promise.all([
    bcrypt.hash('Admin@123', BCRYPT_COST),
    bcrypt.hash('Manager@123', BCRYPT_COST),
    bcrypt.hash('Fighter@123', BCRYPT_COST),
  ]);

  await knex('users').insert([
    {
      id: randomUUID(),
      role_id: roleMap['admin'],
      name: 'Administrator',
      email: 'admin@blazewatch.id',
      password: adminHash,
      phone: null,
      last_login_at: null,
      failed_login_attempts: 0,
      locked_until: null,
      is_active: 1,
      deleted_at: null,
      created_at: now,
      updated_at: now,
    },
    {
      id: randomUUID(),
      role_id: roleMap['building_manager'],
      name: 'Building Manager',
      email: 'manager@blazewatch.id',
      password: managerHash,
      phone: null,
      last_login_at: null,
      failed_login_attempts: 0,
      locked_until: null,
      is_active: 1,
      deleted_at: null,
      created_at: now,
      updated_at: now,
    },
    {
      id: randomUUID(),
      role_id: roleMap['firefighter'],
      name: 'Firefighter',
      email: 'firefighter@blazewatch.id',
      password: firefighterHash,
      phone: null,
      last_login_at: null,
      failed_login_attempts: 0,
      locked_until: null,
      is_active: 1,
      deleted_at: null,
      created_at: now,
      updated_at: now,
    },
  ]);
}

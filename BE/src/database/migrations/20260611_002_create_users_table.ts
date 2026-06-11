import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('users', (table) => {
    table.text('id').primary();
    table
      .text('role_id')
      .notNullable()
      .references('id')
      .inTable('roles')
      .onDelete('RESTRICT');
    table.text('name').notNullable();
    table.text('email').unique().notNullable();
    table.text('password').notNullable();
    table.text('phone').nullable();
    table.text('last_login_at').nullable();
    table.integer('failed_login_attempts').defaultTo(0);
    table.text('locked_until').nullable();
    table.integer('is_active').defaultTo(1);
    table.text('deleted_at').nullable();
    table.text('created_at');
    table.text('updated_at');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('users');
}

import knex, { Knex } from 'knex';
import { env } from './env';

/**
 * Knex SQLite connection for BlazeWatch.
 *
 * - Uses `better-sqlite3` driver (synchronous, no connection pool overhead)
 * - WAL mode enabled for better concurrent read performance
 * - Foreign key enforcement enabled at the SQLite level
 */
const db: Knex = knex({
  client: 'better-sqlite3',
  connection: {
    filename: env.DB_PATH,
  },
  useNullAsDefault: true,
  pool: {
    afterCreate: (
      conn: { pragma: (sql: string) => void },
      done: (err: Error | null) => void,
    ) => {
      try {
        // Enable Write-Ahead Logging for better concurrency
        conn.pragma('journal_mode=WAL');
        // Enforce foreign key constraints
        conn.pragma('foreign_keys=ON');
        done(null);
      } catch (err) {
        done(err as Error);
      }
    },
  },
});

export { db };

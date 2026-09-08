import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "@/db/schema";
import { COLUMN_ADDITIONS, MIGRATION_STATEMENTS } from "@/db/migrations";

const DEFAULT_DB_PATH = "./data/sparring.db";

/**
 * Brings a database up to the current schema. Exported so the upgrade path can
 * be tested against a database built from the old schema — the additions below
 * only ever run on an existing deployment, so a test that starts from the
 * current schema would exercise nothing.
 *
 * `CREATE TABLE IF NOT EXISTS` is idempotent, but SQLite has no
 * `ADD COLUMN IF NOT EXISTS`, so the column additions are a check-then-act that
 * two connections can interleave. An immediate transaction serialises them: the
 * second blocks, then re-reads `table_info` and finds the column already there.
 */
export function applyMigrations(sqlite: Database.Database): void {
  const migrate = sqlite.transaction(() => {
    for (const statement of MIGRATION_STATEMENTS) {
      sqlite.exec(statement);
    }
    for (const addition of COLUMN_ADDITIONS) {
      const columns = sqlite
        .prepare(`PRAGMA table_info(${addition.table})`)
        .all() as Array<{ name: string }>;
      if (columns.some((c) => c.name === addition.column)) continue;
      try {
        sqlite.exec(addition.ddl);
      } catch (error) {
        // Belt and braces: a duplicate column means another connection won the
        // race and the column exists, which is the outcome we wanted anyway.
        // Anything else is a real migration failure and must surface.
        const message = error instanceof Error ? error.message : String(error);
        if (!/duplicate column name/i.test(message)) throw error;
      }
    }
  });
  migrate.immediate();
}

function createDb() {
  const dbPath = process.env.SP_DATABASE_PATH ?? DEFAULT_DB_PATH;
  fs.mkdirSync(path.dirname(path.resolve(dbPath)), { recursive: true });
  // Several processes can open the same database at once — `next build`
  // collects page data in one worker per core, and each worker imports this
  // module. The wait has to be in place before the first statement that takes
  // a lock: `journal_mode = WAL` needs an exclusive one, so setting the
  // timeout after it leaves that very statement unprotected.
  const sqlite = new Database(dbPath, { timeout: 15000 });
  sqlite.pragma("busy_timeout = 15000");
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  applyMigrations(sqlite);

  return drizzle(sqlite, { schema });
}

type Db = ReturnType<typeof createDb>;

const globalForDb = globalThis as unknown as { __sparringDb?: Db };

function resolveDb(): Db {
  globalForDb.__sparringDb ??= createDb();
  return globalForDb.__sparringDb;
}

/**
 * Singleton database client (survives Next.js dev hot reloads), opened on
 * first use rather than on import.
 *
 * Laziness is not an optimisation here, it is a correctness requirement.
 * `next build` imports every route module to collect its page data, which
 * would otherwise create and migrate a database purely as a side effect of
 * building — one per worker, all racing, and inside `docker build` those
 * workers run on an overlay filesystem where SQLite's locking does not hold.
 * A build should not touch a database at all; nothing here opens one until a
 * request actually asks for data.
 */
export const db: Db = new Proxy({} as Db, {
  get(_target, property, receiver) {
    const instance = resolveDb();
    const value = Reflect.get(instance as object, property, receiver);
    return typeof value === "function" ? value.bind(instance) : value;
  },
  has: (_target, property) => Reflect.has(resolveDb() as object, property),
  ownKeys: () => Reflect.ownKeys(resolveDb() as object),
  getOwnPropertyDescriptor: (_target, property) =>
    Reflect.getOwnPropertyDescriptor(resolveDb() as object, property),
});

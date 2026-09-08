import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { applyMigrations } from "@/db/client";
import { COLUMN_ADDITIONS, MIGRATION_STATEMENTS } from "@/db/migrations";

/**
 * The column additions only ever run against a database that predates them, so
 * a test starting from the current schema exercises nothing. These build the
 * old schema first — `MIGRATION_STATEMENTS` alone, which is what a deployment
 * from before any `ALTER` looked like — put real rows in it, and then upgrade.
 *
 * This is the gap that let four defects reach CI: the upgrade path was only
 * ever checked by hand against one developer's database.
 */
const created: string[] = [];

/**
 * `MIGRATION_STATEMENTS` is the CURRENT schema — drizzle regenerates it, so a
 * table added after a column already existed carries that column in its
 * `CREATE`. Two of the six additions are like that. To exercise the upgrade
 * path for all six, strip each added column out of its `CREATE` first: what is
 * left is what a deployment predating every `ALTER` actually had on disk.
 */
function legacySchema(): string[] {
  return MIGRATION_STATEMENTS.map((statement) => {
    let out = statement;
    for (const addition of COLUMN_ADDITIONS) {
      if (!out.includes(`CREATE TABLE IF NOT EXISTS \`${addition.table}\``)) {
        continue;
      }
      out = out
        .split("\n")
        .filter((line) => !line.trim().startsWith(`\`${addition.column}\``))
        .join("\n");
    }
    // Dropping the last column before the closing paren leaves a dangling comma.
    return out.replace(/,(\s*\n?\);?)$/, "$1");
  });
}

function legacyDatabasePath(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sparring-migration-"));
  const file = path.join(dir, "legacy.db");
  created.push(dir);
  const sqlite = new Database(file);
  sqlite.pragma("journal_mode = WAL");
  for (const statement of legacySchema()) sqlite.exec(statement);
  sqlite.close();
  return file;
}

function open(file: string): Database.Database {
  const sqlite = new Database(file, { timeout: 15000 });
  sqlite.pragma("busy_timeout = 15000");
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  return sqlite;
}

function columnsOf(sqlite: Database.Database, table: string): string[] {
  return (
    sqlite.prepare(`PRAGMA table_info(${table})`).all() as Array<{
      name: string;
    }>
  ).map((c) => c.name);
}

afterEach(() => {
  for (const dir of created.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("migrations — upgrading an existing deployment", () => {
  it("adds every declared column to a database built from the old schema", () => {
    const file = legacyDatabasePath();

    // The old schema genuinely lacks them — otherwise this proves nothing.
    const before = open(file);
    for (const addition of COLUMN_ADDITIONS) {
      expect(columnsOf(before, addition.table)).not.toContain(addition.column);
    }
    before.close();

    const sqlite = open(file);
    applyMigrations(sqlite);
    for (const addition of COLUMN_ADDITIONS) {
      expect(columnsOf(sqlite, addition.table)).toContain(addition.column);
    }
    sqlite.close();
  });

  it("preserves rows written before the upgrade", () => {
    const file = legacyDatabasePath();
    const seed = open(file);
    seed
      .prepare(
        "INSERT INTO users (id, email, name, password_hash, role, created_at) VALUES (?,?,?,?,?,?)",
      )
      .run("u1", "rep@test.local", "Existing Rep", "hash", "rep", 1);
    seed.close();

    const sqlite = open(file);
    applyMigrations(sqlite);
    const row = sqlite
      .prepare("SELECT id, email, role FROM users WHERE id = ?")
      .get("u1");
    expect(row).toEqual({ id: "u1", email: "rep@test.local", role: "rep" });
    sqlite.close();
  });

  it("is idempotent — running it repeatedly changes nothing", () => {
    const file = legacyDatabasePath();
    const sqlite = open(file);
    applyMigrations(sqlite);
    const first = COLUMN_ADDITIONS.map((a) => columnsOf(sqlite, a.table));

    expect(() => {
      applyMigrations(sqlite);
      applyMigrations(sqlite);
    }).not.toThrow();

    expect(COLUMN_ADDITIONS.map((a) => columnsOf(sqlite, a.table))).toEqual(
      first,
    );
    sqlite.close();
  });

  it("survives several connections migrating the same database at once", () => {
    // The shape that broke `next build`: one worker per core, each opening the
    // database and racing the others through the same check-then-act.
    const file = legacyDatabasePath();
    const connections = Array.from({ length: 8 }, () => open(file));

    expect(() => {
      for (const sqlite of connections) applyMigrations(sqlite);
    }).not.toThrow();

    for (const addition of COLUMN_ADDITIONS) {
      const names = columnsOf(connections[0], addition.table);
      expect(names).toContain(addition.column);
      // One column, not one per connection.
      expect(names.filter((n) => n === addition.column)).toHaveLength(1);
    }
    for (const sqlite of connections) sqlite.close();
  });

  it("creates a usable database from nothing at all", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sparring-migration-"));
    created.push(dir);
    const sqlite = open(path.join(dir, "fresh.db"));
    applyMigrations(sqlite);
    for (const addition of COLUMN_ADDITIONS) {
      expect(columnsOf(sqlite, addition.table)).toContain(addition.column);
    }
    sqlite.close();
  });
});

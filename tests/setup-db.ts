import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Runs before each test file's module graph loads: point the singleton DB at
 * a unique temp file and force mock models. Each vitest file gets an isolated
 * module registry, so this yields one fresh database per test file.
 */
const dbPath = path.join(
  fs.mkdtempSync(path.join(os.tmpdir(), "sparring-test-")),
  "test.db",
);
process.env.SP_DATABASE_PATH = dbPath;
process.env.SP_MOCK_LLM = "1";

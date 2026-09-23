import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const migrations = [1, 2, 3].map((version) => readFileSync(
  new URL(
    `../src-tauri/migrations/000${version}_${[
      "create_clients_and_tasks",
      "create_work_sessions",
      "enforce_single_working_task",
    ][version - 1]}.sql`,
    import.meta.url,
  ),
  "utf8",
));
const timestamp = "2026-09-22T09:00:00.000Z";

function databasePath() {
  return join(mkdtempSync(join(tmpdir(), "devdesk-time-migration-")), "devdesk.db");
}

function sqlite(path, sql, json = false) {
  return spawnSync("sqlite3", json ? ["-json", path] : [path], {
    input: `.bail on\nPRAGMA foreign_keys = ON;\n${sql}`,
    encoding: "utf8",
  });
}

function rows(result) {
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim() ? JSON.parse(result.stdout) : [];
}

function insertClientAndTask(path, id, status) {
  return sqlite(path, `
    INSERT OR IGNORE INTO clients (id, name, created_at, updated_at)
    VALUES ('client-1', 'Client', '${timestamp}', '${timestamp}');
    INSERT INTO tasks (id, client_id, title, status, created_at, updated_at)
    VALUES ('${id}', 'client-1', 'Task ${id}', '${status}', '${timestamp}', '${timestamp}');
  `);
}

test("fresh migrations create the one-WORKING-task index", () => {
  const path = databasePath();
  const result = sqlite(path, migrations.join("\n"));
  assert.equal(result.status, 0, result.stderr);

  assert.deepEqual(rows(sqlite(path, `
    SELECT name FROM sqlite_schema
    WHERE type = 'index' AND name = 'tasks_single_working_index';
  `, true)), [{ name: "tasks_single_working_index" }]);
});

test("migration 0001 and 0002 upgrade to 0003 without changing task data", () => {
  const path = databasePath();
  assert.equal(sqlite(path, `${migrations[0]}\n${migrations[1]}`).status, 0);
  assert.equal(insertClientAndTask(path, "task-1", "PAUSED").status, 0);

  const upgrade = sqlite(path, migrations[2]);
  assert.equal(upgrade.status, 0, upgrade.stderr);
  assert.deepEqual(rows(sqlite(path, `
    SELECT id, status FROM tasks;
  `, true)), [{ id: "task-1", status: "PAUSED" }]);
});

test("database rejects a second WORKING task", () => {
  const path = databasePath();
  assert.equal(sqlite(path, migrations.join("\n")).status, 0);
  assert.equal(insertClientAndTask(path, "task-1", "WORKING").status, 0);

  const second = insertClientAndTask(path, "task-2", "WORKING");
  assert.notEqual(second.status, 0);
  assert.match(second.stderr, /UNIQUE constraint failed/);
});

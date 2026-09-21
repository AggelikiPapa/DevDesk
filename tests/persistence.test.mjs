import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const migration = readFileSync(
  new URL("../src-tauri/migrations/0001_create_clients_and_tasks.sql", import.meta.url),
  "utf8",
);
const timestamp = "2026-09-21T12:34:56.789Z";

function databasePath() {
  return join(mkdtempSync(join(tmpdir(), "devdesk-db-test-")), "devdesk.db");
}

function sqlite(path, sql, json = false) {
  const result = spawnSync("sqlite3", json ? ["-json", path] : [path], {
    input: `.bail on\nPRAGMA foreign_keys = ON;\n${sql}`,
    encoding: "utf8",
  });
  return result;
}

function initialize(path) {
  const result = sqlite(path, migration);
  assert.equal(result.status, 0, result.stderr);
}

function insertClient(path) {
  const result = sqlite(
    path,
    `INSERT INTO clients (id, name, display_name, created_at, updated_at)
     VALUES ('client-1', 'enerwave', 'Enerwave', '${timestamp}', '${timestamp}');`,
  );
  assert.equal(result.status, 0, result.stderr);
}

test("initial migration creates the clients and tasks schema", () => {
  const path = databasePath();
  initialize(path);
  const result = sqlite(
    path,
    "SELECT name FROM sqlite_schema WHERE type = 'table' AND name IN ('clients', 'tasks') ORDER BY name;",
    true,
  );
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), [{ name: "clients" }, { name: "tasks" }]);
});

test("persists and reads a client", () => {
  const path = databasePath();
  initialize(path);
  insertClient(path);
  const result = sqlite(path, "SELECT id, name, display_name FROM clients;", true);
  assert.deepEqual(JSON.parse(result.stdout), [
    { id: "client-1", name: "enerwave", display_name: "Enerwave" },
  ]);
});

test("persists and reads a task for an existing client", () => {
  const path = databasePath();
  initialize(path);
  insertClient(path);
  const insert = sqlite(
    path,
    `INSERT INTO tasks (
       id, client_id, external_key, title, status, next_action, created_at, updated_at
     ) VALUES (
       'task-1', 'client-1', 'ENW-142', 'Update contract generation logic',
       'PAUSED', 'Check null handling', '${timestamp}', '${timestamp}'
     );`,
  );
  assert.equal(insert.status, 0, insert.stderr);
  const result = sqlite(path, "SELECT id, client_id, external_key, status FROM tasks;", true);
  assert.deepEqual(JSON.parse(result.stdout), [
    { id: "task-1", client_id: "client-1", external_key: "ENW-142", status: "PAUSED" },
  ]);
});

test("rejects a task with an invalid status", () => {
  const path = databasePath();
  initialize(path);
  insertClient(path);
  const result = sqlite(
    path,
    `INSERT INTO tasks (id, client_id, title, status, created_at, updated_at)
     VALUES ('task-1', 'client-1', 'Invalid task', 'INVALID', '${timestamp}', '${timestamp}');`,
  );
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /CHECK constraint failed/);
});

test("rejects a task whose client does not exist", () => {
  const path = databasePath();
  initialize(path);
  const result = sqlite(
    path,
    `INSERT INTO tasks (id, client_id, title, status, created_at, updated_at)
     VALUES ('task-1', 'missing-client', 'Orphan task', 'NEW', '${timestamp}', '${timestamp}');`,
  );
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /FOREIGN KEY constraint failed/);
});

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const migration1 = readFileSync(
  new URL("../src-tauri/migrations/0001_create_clients_and_tasks.sql", import.meta.url),
  "utf8",
);
const migration2 = readFileSync(
  new URL("../src-tauri/migrations/0002_create_work_sessions.sql", import.meta.url),
  "utf8",
);
const t0 = "2026-09-21T09:00:00.000Z";
const t1 = "2026-09-21T09:30:00.000Z";
const t2 = "2026-09-21T10:00:00.000Z";

function databasePath() {
  return join(mkdtempSync(join(tmpdir(), "devdesk-session-test-")), "devdesk.db");
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

function initialize(path, includeWorkSessions = true) {
  const result = sqlite(path, includeWorkSessions ? `${migration1}\n${migration2}` : migration1);
  assert.equal(result.status, 0, result.stderr);
}

function insertTask(path, id = "task-1") {
  const result = sqlite(path, `
    INSERT OR IGNORE INTO clients (id, name, created_at, updated_at)
    VALUES ('client-1', 'Client', '${t0}', '${t0}');
    INSERT INTO tasks (id, client_id, title, status, created_at, updated_at)
    VALUES ('${id}', 'client-1', 'Task ${id}', 'NEW', '${t0}', '${t0}');
  `);
  assert.equal(result.status, 0, result.stderr);
}

function insertSession(path, { id = "session-1", taskId = "task-1", startedAt = t0, endedAt = null } = {}) {
  const endedValue = endedAt === null ? "NULL" : `'${endedAt}'`;
  return sqlite(path, `
    INSERT INTO work_sessions (id, task_id, started_at, ended_at, created_at)
    VALUES ('${id}', '${taskId}', '${startedAt}', ${endedValue}, '${startedAt}');
  `);
}

test("fresh migration creates WorkSession schema and active-session index", () => {
  const path = databasePath();
  initialize(path);

  assert.deepEqual(rows(sqlite(path, `
    SELECT name, type FROM sqlite_schema
    WHERE name IN ('work_sessions', 'work_sessions_single_active_index')
    ORDER BY name;
  `, true)), [
    { name: "work_sessions", type: "table" },
    { name: "work_sessions_single_active_index", type: "index" },
  ]);
});

test("migration 0001 to 0002 preserves existing task data", () => {
  const path = databasePath();
  initialize(path, false);
  insertTask(path);

  const upgrade = sqlite(path, migration2);
  assert.equal(upgrade.status, 0, upgrade.stderr);
  assert.deepEqual(rows(sqlite(path, "SELECT id, title FROM tasks;", true)), [
    { id: "task-1", title: "Task task-1" },
  ]);
  assert.deepEqual(rows(sqlite(path, "SELECT count(*) AS count FROM work_sessions;", true)), [
    { count: 0 },
  ]);
});

test("creates and retrieves an active session for an existing task", () => {
  const path = databasePath();
  initialize(path);
  insertTask(path);
  const insert = insertSession(path);
  assert.equal(insert.status, 0, insert.stderr);

  assert.deepEqual(rows(sqlite(path, `
    SELECT id, task_id, started_at, ended_at, created_at
    FROM work_sessions WHERE ended_at IS NULL;
  `, true)), [{
    id: "session-1",
    task_id: "task-1",
    started_at: t0,
    ended_at: null,
    created_at: t0,
  }]);
});

test("returns no active session when all sessions are closed", () => {
  const path = databasePath();
  initialize(path);
  insertTask(path);
  assert.equal(insertSession(path, { endedAt: t1 }).status, 0);

  assert.deepEqual(rows(sqlite(
    path,
    "SELECT id FROM work_sessions WHERE ended_at IS NULL;",
    true,
  )), []);
});

test("lists task sessions deterministically from oldest to newest", () => {
  const path = databasePath();
  initialize(path);
  insertTask(path);
  assert.equal(insertSession(path, { id: "session-2", startedAt: t1, endedAt: t2 }).status, 0);
  assert.equal(insertSession(path, { id: "session-1", startedAt: t0, endedAt: t1 }).status, 0);

  assert.deepEqual(rows(sqlite(path, `
    SELECT id FROM work_sessions
    WHERE task_id = 'task-1'
    ORDER BY started_at, id;
  `, true)), [{ id: "session-1" }, { id: "session-2" }]);
});

test("rejects sessions for unknown tasks", () => {
  const path = databasePath();
  initialize(path);
  const result = insertSession(path, { taskId: "missing" });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /FOREIGN KEY constraint failed/);
});

test("database rejects a second globally active session", () => {
  const path = databasePath();
  initialize(path);
  insertTask(path);
  insertTask(path, "task-2");
  assert.equal(insertSession(path).status, 0);
  const second = insertSession(path, { id: "session-2", taskId: "task-2", startedAt: t1 });

  assert.notEqual(second.status, 0);
  assert.match(second.stderr, /UNIQUE constraint failed/);
});

test("closes an active session and refuses a second close", () => {
  const path = databasePath();
  initialize(path);
  insertTask(path);
  assert.equal(insertSession(path).status, 0);

  const close = sqlite(path, `
    UPDATE work_sessions SET ended_at = '${t1}'
    WHERE id = 'session-1' AND ended_at IS NULL AND started_at <= '${t1}';
    SELECT changes() AS changes;
  `, true);
  assert.deepEqual(rows(close), [{ changes: 1 }]);

  const secondClose = sqlite(path, `
    UPDATE work_sessions SET ended_at = '${t2}'
    WHERE id = 'session-1' AND ended_at IS NULL AND started_at <= '${t2}';
    SELECT changes() AS changes;
  `, true);
  assert.deepEqual(rows(secondClose), [{ changes: 0 }]);
});

test("rejects end times before start and unknown session mutations", () => {
  const path = databasePath();
  initialize(path);
  insertTask(path);
  const invalid = insertSession(path, {
    startedAt: t1,
    endedAt: "2026-09-21T09:29:59.999Z",
  });
  assert.notEqual(invalid.status, 0);
  assert.match(invalid.stderr, /CHECK constraint failed/);

  assert.deepEqual(rows(sqlite(path, `
    UPDATE work_sessions SET ended_at = '${t1}' WHERE id = 'missing';
    SELECT changes() AS changes;
  `, true)), [{ changes: 0 }]);
});

test("task archival preserves sessions and task deletion is restricted", () => {
  const path = databasePath();
  initialize(path);
  insertTask(path);
  assert.equal(insertSession(path, { endedAt: t1 }).status, 0);

  const archive = sqlite(path, `
    UPDATE tasks SET archived_at = '${t2}', updated_at = '${t2}' WHERE id = 'task-1';
  `);
  assert.equal(archive.status, 0, archive.stderr);
  assert.deepEqual(rows(sqlite(path, "SELECT id, task_id FROM work_sessions;", true)), [
    { id: "session-1", task_id: "task-1" },
  ]);

  const deletion = sqlite(path, "DELETE FROM tasks WHERE id = 'task-1';");
  assert.notEqual(deletion.status, 0);
  assert.match(deletion.stderr, /FOREIGN KEY constraint failed/);
});

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { OVERLAPPING_SESSIONS_SQL } from "../src/services/persistence/todayStore.ts";

const migrations = [
  "0001_create_clients_and_tasks.sql",
  "0002_create_work_sessions.sql",
  "0003_enforce_single_working_task.sql",
  "0004_add_task_order.sql",
].map((name) => readFileSync(new URL(`../src-tauri/migrations/${name}`, import.meta.url), "utf8"));
const t = "2026-09-25T00:00:00.000Z";

function sqlite(path, sql, json = false) {
  return spawnSync("sqlite3", json ? ["-json", path] : [path], {
    input: `.bail on\nPRAGMA foreign_keys = ON;\n${sql}`,
    encoding: "utf8",
  });
}

test("overlap query returns only intersecting sessions with archived task and client details", () => {
  const path = join(mkdtempSync(join(tmpdir(), "devdesk-today-")), "devdesk.db");
  const setup = sqlite(path, `${migrations.join("\n")}
    INSERT INTO clients (id, name, display_name, created_at, updated_at)
    VALUES ('client', 'acme', 'Acme', '${t}', '${t}');
    INSERT INTO tasks (id, client_id, title, external_key, status, created_at, updated_at, archived_at)
    VALUES ('task', 'client', 'Archived task', 'AC-1', 'DONE', '${t}', '${t}', '${t}');
    INSERT INTO tasks (id, client_id, title, status, created_at, updated_at)
    VALUES ('active-task', 'client', 'Active task', 'WORKING', '${t}', '${t}');
    INSERT INTO work_sessions (id, task_id, started_at, ended_at, created_at) VALUES
      ('before', 'task', '2026-09-24T22:00:00.000Z', '${t}', '${t}'),
      ('crossing', 'task', '2026-09-24T23:50:00.000Z', '2026-09-25T00:20:00.000Z', '${t}'),
      ('inside', 'task', '2026-09-25T09:00:00.000Z', '2026-09-25T09:30:00.000Z', '${t}'),
      ('running', 'active-task', '2026-09-25T10:00:00.000Z', NULL, '${t}'),
      ('after', 'task', '2026-09-26T00:00:00.000Z', '2026-09-26T00:30:00.000Z', '${t}');`);
  assert.equal(setup.status, 0, setup.stderr);
  const query = OVERLAPPING_SESSIONS_SQL
    .replaceAll("$1", "'2026-09-25T00:00:00.000Z'")
    .replaceAll("$2", "'2026-09-26T00:00:00.000Z'");
  const result = sqlite(path, query, true);
  assert.equal(result.status, 0, result.stderr);
  const rows = JSON.parse(result.stdout);
  assert.deepEqual(rows.map((row) => row.work_session_id), ["crossing", "inside", "running"]);
  assert.equal(rows[0].client_name, "Acme");
  assert.equal(rows[0].external_key, "AC-1");
  assert.equal(rows[0].task_title, "Archived task");
});

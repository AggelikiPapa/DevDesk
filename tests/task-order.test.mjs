import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { reorderTasks } from "../src/features/tasks/reorderTasks.ts";

const migrations = [
  "0001_create_clients_and_tasks.sql",
  "0002_create_work_sessions.sql",
  "0003_enforce_single_working_task.sql",
  "0004_add_task_order.sql",
].map((name) => readFileSync(new URL(`../src-tauri/migrations/${name}`, import.meta.url), "utf8"));
const timestamp = "2026-09-23T09:00:00.000Z";

function sqlite(path, sql, json = false) {
  return spawnSync("sqlite3", json ? ["-json", path] : [path], {
    input: `.bail on\nPRAGMA foreign_keys = ON;\n${sql}`,
    encoding: "utf8",
  });
}

test("task move uses target position without mutating the original list", () => {
  const tasks = [{ id: "a" }, { id: "b" }, { id: "c" }];
  assert.deepEqual(reorderTasks(tasks, "a", "c").map((task) => task.id), ["b", "c", "a"]);
  assert.deepEqual(reorderTasks(tasks, "c", "a").map((task) => task.id), ["c", "a", "b"]);
  assert.deepEqual(tasks.map((task) => task.id), ["a", "b", "c"]);
});

test("task-order migration preserves the former visible order and supports new tasks", () => {
  const path = join(mkdtempSync(join(tmpdir(), "devdesk-order-")), "devdesk.db");
  const setup = sqlite(path, `${migrations.slice(0, 3).join("\n")}
    INSERT INTO clients (id, name, created_at, updated_at)
    VALUES ('client', 'Client', '${timestamp}', '${timestamp}');
    INSERT INTO tasks (id, client_id, title, status, created_at, updated_at)
    VALUES ('older', 'client', 'Older', 'NEW', '${timestamp}', '${timestamp}');
    INSERT INTO tasks (id, client_id, title, status, created_at, updated_at)
    VALUES ('newer', 'client', 'Newer', 'NEW', '${timestamp}', '2026-09-23T10:00:00.000Z');`);
  assert.equal(setup.status, 0, setup.stderr);
  const upgrade = sqlite(path, migrations[3]);
  assert.equal(upgrade.status, 0, upgrade.stderr);

  const rows = sqlite(path, "SELECT id FROM tasks WHERE archived_at IS NULL ORDER BY sort_order, id;", true);
  assert.equal(rows.status, 0, rows.stderr);
  assert.deepEqual(JSON.parse(rows.stdout), [{ id: "newer" }, { id: "older" }]);
  const insert = sqlite(path, `INSERT INTO tasks (id, client_id, title, status, created_at, updated_at, sort_order)
    VALUES ('latest', 'client', 'Latest', 'NEW', '${timestamp}', '${timestamp}',
      (SELECT COALESCE(MIN(sort_order), 0) - 1 FROM tasks WHERE archived_at IS NULL));`);
  assert.equal(insert.status, 0, insert.stderr);
  const after = sqlite(path, "SELECT id FROM tasks WHERE archived_at IS NULL ORDER BY sort_order, id;", true);
  assert.deepEqual(JSON.parse(after.stdout), [{ id: "latest" }, { id: "newer" }, { id: "older" }]);
});

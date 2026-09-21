import assert from "node:assert/strict";
import test from "node:test";

import {
  addTask,
  clientOptions,
  removeTask,
  replaceTask,
  selectedTaskId,
} from "../src/features/tasks/workspaceState.ts";

const client = {
  id: "client-1",
  name: "acme",
  displayName: "Acme Corp",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const task = {
  id: "task-1",
  clientId: client.id,
  externalKey: null,
  title: "First task",
  status: "NEW",
  nextAction: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  archivedAt: null,
};

test("persisted clients populate selector options with their display labels", () => {
  assert.deepEqual(clientOptions([client]), [{ value: "client-1", label: "Acme Corp" }]);
  assert.deepEqual(clientOptions([{ ...client, displayName: null }]), [
    { value: "client-1", label: "acme" },
  ]);
});

test("created and edited tasks update workspace state", () => {
  const created = addTask([], task);
  assert.deepEqual(created, [task]);

  const edited = { ...task, title: "Edited task" };
  assert.deepEqual(replaceTask(created, edited), [edited]);
});

test("selection falls back after an active task is removed", () => {
  const second = { ...task, id: "task-2", title: "Second task" };
  const remaining = removeTask([task, second], task.id);

  assert.deepEqual(remaining, [second]);
  assert.equal(selectedTaskId(remaining, task.id), second.id);
  assert.equal(selectedTaskId([], second.id), null);
});

import assert from "node:assert/strict";
import test from "node:test";

import {
  createTimeEngine,
  TimeEngineError,
  toTimeEngineError,
} from "../src/services/application/timeEngine.ts";

test("timeEngine maps typed methods to narrow native commands", async () => {
  const calls = [];
  const invoker = async (command, args) => {
    calls.push({ command, args });
    return { command };
  };
  const engine = createTimeEngine(invoker);

  assert.deepEqual(await engine.startTask("task-1"), { command: "start_task" });
  assert.deepEqual(await engine.pauseTask("task-1"), { command: "pause_task" });
  assert.deepEqual(await engine.switchTask("task-2"), { command: "switch_task" });
  assert.deepEqual(await engine.completeActiveTask("task-2"), {
    command: "complete_active_task",
  });
  assert.deepEqual(calls, [
    { command: "start_task", args: { taskId: "task-1" } },
    { command: "pause_task", args: { taskId: "task-1" } },
    { command: "switch_task", args: { targetTaskId: "task-2" } },
    { command: "complete_active_task", args: { taskId: "task-2" } },
  ]);
});

test("timeEngine preserves structured native errors", async () => {
  const engine = createTimeEngine(async () => {
    throw { code: "TASK_ARCHIVED", message: "Archived tasks cannot be started." };
  });

  await assert.rejects(
    engine.startTask("task-1"),
    (error) =>
      error instanceof TimeEngineError &&
      error.code === "TASK_ARCHIVED" &&
      error.message === "Archived tasks cannot be started.",
  );
});

test("timeEngine converts unexpected failures to a stable error", () => {
  const error = toTimeEngineError("unexpected rejection");
  assert.ok(error instanceof TimeEngineError);
  assert.equal(error.code, "TIME_ENGINE_ERROR");
  assert.equal(error.message, "DevDesk could not complete the time operation.");
});

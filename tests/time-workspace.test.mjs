import assert from "node:assert/strict";
import test from "node:test";

import {
  canArchiveTask,
  formatDuration,
  taskDurationLabel,
  timeActionForTask,
  timeActionLabel,
} from "../src/features/tasks/timePresentation.ts";
import {
  applyPausedOrCompleted,
  applyStarted,
  applySwitched,
  startupSelection,
} from "../src/features/tasks/workspaceState.ts";

const timestamp = "2026-09-23T09:00:00.000Z";
const taskA = {
  id: "task-a", clientId: "client", externalKey: "A-1", title: "Task A",
  status: "NEW", nextAction: null, createdAt: timestamp, updatedAt: timestamp,
  archivedAt: null,
};
const taskB = { ...taskA, id: "task-b", externalKey: "B-2", title: "Task B" };
const activeA = {
  id: "session-a", taskId: "task-a", startedAt: timestamp,
  endedAt: null, createdAt: timestamp,
};
const base = {
  tasks: [taskB, taskA], activeSession: null, selection: "task-b",
  selectedSessions: { taskId: "task-b", sessions: [] },
};

test("formats zero and durations greater than one hour", () => {
  assert.equal(formatDuration(0), "00:00:00");
  assert.equal(formatDuration(5_067_999), "01:24:27");
  assert.throws(() => formatDuration(-1), RangeError);
});

test("completed duration stays fixed and active duration uses explicit now", () => {
  const closed = { ...activeA, endedAt: "2026-09-23T09:30:00.000Z" };
  assert.equal(taskDurationLabel([closed], false), "00:30:00");
  assert.equal(taskDurationLabel([closed, { ...activeA, id: "session-2", startedAt: "2026-09-23T10:00:00.000Z" }], true, "2026-09-23T10:15:05.999Z"), "00:45:05");
  assert.equal(taskDurationLabel([closed], false, "2026-09-23T12:00:00.000Z"), "00:30:00");
});

test("startup selects the active task and selecting elsewhere preserves activity", () => {
  assert.equal(startupSelection(base.tasks, activeA), "task-a");
  assert.equal(startupSelection(base.tasks, null), "task-b");
  const inspectingB = { ...base, activeSession: activeA };
  assert.equal(inspectingB.selection, "task-b");
  assert.equal(inspectingB.activeSession, activeA);
});

test("start, pause, switch, and active completion reconcile task and session state", () => {
  const workingA = { ...taskA, status: "WORKING" };
  const started = applyStarted(base, workingA, activeA);
  assert.equal(started.selection, "task-a");
  assert.equal(started.activeSession.id, activeA.id);
  assert.equal(started.tasks.find((task) => task.id === "task-a").status, "WORKING");

  const withHistory = { ...started, selectedSessions: { taskId: "task-a", sessions: [activeA] } };
  const closedA = { ...activeA, endedAt: "2026-09-23T09:10:00.000Z" };
  const paused = applyPausedOrCompleted(withHistory, { ...taskA, status: "PAUSED" }, closedA);
  assert.equal(paused.activeSession, null);
  assert.equal(paused.selectedSessions.sessions[0].endedAt, closedA.endedAt);

  const activeB = { ...activeA, id: "session-b", taskId: "task-b" };
  const switched = applySwitched(withHistory, { ...taskA, status: "PAUSED" }, { ...taskB, status: "WORKING" }, activeB);
  assert.equal(switched.selection, "task-b");
  assert.equal(switched.activeSession.taskId, "task-b");
  assert.equal(switched.tasks.find((task) => task.id === "task-a").status, "PAUSED");
  assert.equal(switched.tasks.find((task) => task.id === "task-b").status, "WORKING");

  const completed = applyPausedOrCompleted(withHistory, { ...taskA, status: "DONE" }, closedA);
  assert.equal(completed.activeSession, null);
  assert.equal(completed.tasks.find((task) => task.id === "task-a").status, "DONE");
});

test("controls follow task state and active session", () => {
  assert.equal(timeActionLabel(taskA, timeActionForTask(taskA, null)), "Start");
  assert.equal(timeActionLabel({ ...taskA, status: "PAUSED" }, timeActionForTask({ ...taskA, status: "PAUSED" }, null)), "Resume");
  assert.equal(timeActionLabel({ ...taskA, status: "WORKING" }, timeActionForTask({ ...taskA, status: "WORKING" }, activeA)), "Pause");
  assert.equal(timeActionLabel(taskB, timeActionForTask(taskB, activeA)), "Switch to this task");
  assert.equal(timeActionForTask({ ...taskA, status: "DONE" }, null), null);
  assert.equal(timeActionForTask({ ...taskA, status: "WORKING" }, null), null);
  assert.equal(canArchiveTask({ ...taskA, status: "WORKING" }, activeA), false);
  assert.equal(canArchiveTask(taskA, activeA), false);
  assert.equal(canArchiveTask({ ...taskA, status: "PAUSED" }, null), true);
});

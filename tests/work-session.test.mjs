import assert from "node:assert/strict";
import test from "node:test";

import { calculateRecordedDuration } from "../src/services/application/calculateRecordedDuration.ts";
import { createWorkSessionApplicationService } from "../src/services/application/workSessionService.ts";
import {
  WorkSessionCloseError,
  workSessionCloseFailure,
} from "../src/services/persistence/workSessionStore.ts";

function session(overrides = {}) {
  return {
    id: "session-1",
    taskId: "task-1",
    startedAt: "2026-09-21T09:00:00.000Z",
    endedAt: "2026-09-21T09:30:00.000Z",
    createdAt: "2026-09-21T09:00:00.000Z",
    ...overrides,
  };
}

test("calculates completed and multiple-session duration in milliseconds", () => {
  assert.equal(calculateRecordedDuration([session()]), 30 * 60 * 1000);
  assert.equal(calculateRecordedDuration([
    session(),
    session({
      id: "session-2",
      startedAt: "2026-09-21T10:00:00.000Z",
      endedAt: "2026-09-21T11:00:00.000Z",
    }),
  ]), 90 * 60 * 1000);
});

test("ignores an active session unless an explicit now is supplied", () => {
  const active = session({ endedAt: null });

  assert.equal(calculateRecordedDuration([active]), 0);
  assert.equal(
    calculateRecordedDuration([active], "2026-09-21T09:45:00.000Z"),
    45 * 60 * 1000,
  );
});

test("rejects invalid duration intervals", () => {
  assert.throws(
    () => calculateRecordedDuration([
      session({ endedAt: "2026-09-21T08:59:59.999Z" }),
    ]),
    RangeError,
  );
});

test("application service exposes read-only session queries and duration", async () => {
  const sessions = [session()];
  const requestedTasks = [];
  const store = {
    async getActiveWorkSession() { return null; },
    async listWorkSessionsForTask() { return sessions; },
  };
  const tasks = {
    async getTask(id) {
      requestedTasks.push(id);
      return { id };
    },
  };
  const service = createWorkSessionApplicationService(store, tasks);

  assert.equal(await service.getActiveSession(), null);
  assert.deepEqual(await service.getTaskSessions("task-1"), sessions);
  assert.equal(await service.getTaskRecordedDuration("task-1"), 30 * 60 * 1000);
  assert.deepEqual(requestedTasks, ["task-1", "task-1"]);
  assert.equal("createWorkSession" in service, false);
  assert.equal("closeWorkSession" in service, false);
});

test("close failures distinguish unknown, closed, and invalid sessions", () => {
  const unknown = workSessionCloseFailure("missing", null);
  const closed = workSessionCloseFailure("session-1", session());
  const invalid = workSessionCloseFailure("session-1", session({ endedAt: null }));

  assert.ok(unknown instanceof WorkSessionCloseError);
  assert.equal(unknown.code, "WORK_SESSION_NOT_FOUND");
  assert.equal(closed.code, "WORK_SESSION_ALREADY_CLOSED");
  assert.equal(invalid.code, "INVALID_END_TIME");
});

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

import { buildTodayReport, localDayRange } from "../src/services/application/todayService.ts";
import { todayDisplayedDurations } from "../src/features/today/todayPresentation.ts";

const day = { key: "2026-09-25", start: "2026-09-25T00:00:00.000Z", end: "2026-09-26T00:00:00.000Z" };
const now = "2026-09-25T12:00:00.000Z";

function session(id, startedAt, endedAt, overrides = {}) {
  return {
    workSessionId: id,
    taskId: "task-a",
    clientId: "client-a",
    clientName: "Acme",
    externalKey: "AC-1",
    taskTitle: "First task",
    startedAt,
    endedAt,
    ...overrides,
  };
}

test("empty day has zero total and no groups or timeline", () => {
  assert.deepEqual(buildTodayReport([], day, now), { totalMs: 0, clients: [], timeline: [] });
});

test("fully contained completed session contributes its full duration", () => {
  const report = buildTodayReport([session("one", "2026-09-25T09:00:00.000Z", "2026-09-25T09:30:00.000Z")], day, now);
  assert.equal(report.totalMs, 30 * 60_000);
  assert.equal(report.clients[0].tasks[0].durationMs, report.totalMs);
  assert.equal(report.timeline[0].running, false);
});

test("repeated task sessions merge in summary but remain separate in chronological timeline", () => {
  const sessions = [
    session("late", "2026-09-25T10:15:00.000Z", "2026-09-25T11:00:00.000Z"),
    session("early", "2026-09-25T09:00:00.000Z", "2026-09-25T09:30:00.000Z"),
  ];
  const report = buildTodayReport(sessions, day, now);
  assert.equal(report.clients[0].tasks.length, 1);
  assert.equal(report.clients[0].tasks[0].durationMs, 75 * 60_000);
  assert.deepEqual(report.timeline.map((entry) => entry.workSessionId), ["early", "late"]);
});

test("client and task summaries total correctly and sort by duration with deterministic ties", () => {
  const report = buildTodayReport([
    session("b", "2026-09-25T10:00:00.000Z", "2026-09-25T10:30:00.000Z", {
      taskId: "task-b", externalKey: "AC-2", taskTitle: "Second task",
    }),
    session("c", "2026-09-25T11:00:00.000Z", "2026-09-25T11:20:00.000Z", {
      taskId: "task-c", clientId: "client-b", clientName: "Beta", taskTitle: "Beta task",
    }),
    session("a", "2026-09-25T09:00:00.000Z", "2026-09-25T09:45:00.000Z"),
  ], day, now);
  assert.deepEqual(report.clients.map((client) => [client.name, client.durationMs]), [
    ["Acme", 75 * 60_000], ["Beta", 20 * 60_000],
  ]);
  assert.deepEqual(report.clients[0].tasks.map((task) => task.taskId), ["task-a", "task-b"]);
  assert.equal(report.totalMs, 95 * 60_000);
  const tied = buildTodayReport([
    session("b", "2026-09-25T09:00:00.000Z", "2026-09-25T09:01:00.000Z", {
      clientId: "client-b", clientName: "Beta", taskId: "task-b",
    }),
    session("a", "2026-09-25T10:00:00.000Z", "2026-09-25T10:01:00.000Z"),
  ], day, now);
  assert.deepEqual(tied.clients.map((client) => client.name), ["Acme", "Beta"]);
});

test("sessions crossing either midnight or the whole day are clipped to the day", () => {
  const report = buildTodayReport([
    session("from-yesterday", "2026-09-24T23:50:00.000Z", "2026-09-25T00:20:00.000Z"),
    session("to-tomorrow", "2026-09-25T23:50:00.000Z", "2026-09-26T00:20:00.000Z"),
    session("whole-day", "2026-09-24T20:00:00.000Z", "2026-09-26T04:00:00.000Z"),
  ], day, now);
  assert.deepEqual(Object.fromEntries(report.timeline.map((entry) => [entry.workSessionId, entry.durationMs])), {
    "from-yesterday": 20 * 60_000,
    "to-tomorrow": 10 * 60_000,
    "whole-day": 24 * 3_600_000,
  });
  const wholeDay = report.timeline.find((entry) => entry.workSessionId === "whole-day");
  assert.equal(wholeDay.effectiveStart, day.start);
  assert.equal(wholeDay.effectiveEnd, day.end);
});

test("active session advances with explicit now and no persistence writes", () => {
  const sessions = [session("active", "2026-09-25T09:00:00.000Z", null)];
  const first = buildTodayReport(sessions, day, "2026-09-25T09:00:01.000Z");
  const second = buildTodayReport(sessions, day, "2026-09-25T09:00:02.000Z");
  assert.equal(first.totalMs, 1000);
  assert.equal(second.totalMs, 2000);
  assert.equal(second.timeline[0].running, true);
  assert.equal(sessions[0].endedAt, null);
  const capped = buildTodayReport(sessions, day, "2026-09-26T00:20:00.000Z");
  assert.equal(capped.totalMs, 15 * 3_600_000);
  assert.equal(capped.timeline[0].running, false);
});

test("non-overlapping sessions contribute nothing and malformed dates fail clearly", () => {
  const outside = [
    session("before", "2026-09-24T22:00:00.000Z", day.start),
    session("after", day.end, "2026-09-26T01:00:00.000Z"),
  ];
  assert.deepEqual(buildTodayReport(outside, day, now), { totalMs: 0, clients: [], timeline: [] });
  assert.throws(() => buildTodayReport([session("bad", "not-a-date", null)], day, now), /Invalid session start/);
  assert.throws(() => buildTodayReport([session("bad", now, day.start)], day, now), /ends before/);
});

test("local day boundaries use calendar dates, including daylight-saving days", () => {
  const script = `import { localDayRange } from ${JSON.stringify(new URL("../src/services/application/todayService.ts", import.meta.url).href)};
    console.log(JSON.stringify([
      localDayRange(new Date('2026-03-08T18:00:00.000Z')),
      localDayRange(new Date('2026-11-01T18:00:00.000Z')),
    ]));`;
  const result = spawnSync(process.execPath, ["--experimental-strip-types", "--input-type=module", "-e", script], {
    env: { ...process.env, TZ: "America/New_York" }, encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  const [spring, fall] = JSON.parse(result.stdout);
  assert.equal(spring.key, "2026-03-08");
  assert.equal(Date.parse(spring.end) - Date.parse(spring.start), 23 * 3_600_000);
  assert.equal(fall.key, "2026-11-01");
  assert.equal(Date.parse(fall.end) - Date.parse(fall.start), 25 * 3_600_000);
  const today = localDayRange(new Date());
  assert.ok(Date.parse(today.end) > Date.parse(today.start));
});

test("displayed total equals the sum of displayed session and client seconds", () => {
  const report = buildTodayReport([
    session("one", "2026-09-25T09:00:00.000Z", "2026-09-25T09:00:01.900Z"),
    session("two", "2026-09-25T10:00:00.000Z", "2026-09-25T10:00:02.900Z", {
      taskId: "task-b", clientId: "client-b", clientName: "Beta",
    }),
  ], day, now);
  assert.equal(report.totalMs, 4800);
  const displayed = todayDisplayedDurations(report);
  assert.equal(displayed.totalMs, 3000);
  assert.equal([...displayed.clients.values()].reduce((sum, value) => sum + value, 0), displayed.totalMs);
  assert.equal([...displayed.sessions.values()].reduce((sum, value) => sum + value, 0), displayed.totalMs);
});

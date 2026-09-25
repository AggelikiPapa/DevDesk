import { listWorkSessionsOverlapping } from "../persistence/todayStore.ts";
import type { TodaySessionRecord } from "../../types/reporting.ts";

export interface LocalDayRange {
  key: string;
  start: string;
  end: string;
}

export interface TodayTimelineEntry extends TodaySessionRecord {
  effectiveStart: string;
  effectiveEnd: string;
  durationMs: number;
  running: boolean;
}

export interface TodayTaskSummary {
  taskId: string;
  externalKey: string | null;
  title: string;
  durationMs: number;
}

export interface TodayClientSummary {
  clientId: string;
  name: string;
  durationMs: number;
  tasks: TodayTaskSummary[];
}

export interface TodayReport {
  totalMs: number;
  clients: TodayClientSummary[];
  timeline: TodayTimelineEntry[];
}

export function localDayRange(now: Date): LocalDayRange {
  if (!Number.isFinite(now.getTime())) throw new RangeError("Invalid current date.");
  const year = now.getFullYear();
  const month = now.getMonth();
  const date = now.getDate();
  return {
    key: `${year}-${String(month + 1).padStart(2, "0")}-${String(date).padStart(2, "0")}`,
    start: new Date(year, month, date).toISOString(),
    end: new Date(year, month, date + 1).toISOString(),
  };
}

function timestamp(value: string, field: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new RangeError(`Invalid ${field} timestamp: ${value}`);
  return parsed;
}

export function buildTodayReport(
  sessions: readonly TodaySessionRecord[],
  day: LocalDayRange,
  now: string,
): TodayReport {
  const start = timestamp(day.start, "day start");
  const end = timestamp(day.end, "next day start");
  const current = timestamp(now, "now");
  if (end <= start) throw new RangeError("Invalid local day range.");

  const timeline: TodayTimelineEntry[] = [];
  const clients = new Map<string, TodayClientSummary>();
  const tasks = new Map<string, TodayTaskSummary>();
  let totalMs = 0;

  for (const session of sessions) {
    const began = timestamp(session.startedAt, "session start");
    const finished = session.endedAt === null ? current : timestamp(session.endedAt, "session end");
    if (session.endedAt !== null && finished < began) {
      throw new RangeError(`WorkSession ends before it starts: ${session.workSessionId}`);
    }
    const effectiveStart = Math.max(began, start);
    const effectiveEnd = Math.min(finished, end);
    if (effectiveEnd <= effectiveStart) continue;
    const durationMs = effectiveEnd - effectiveStart;
    timeline.push({
      ...session,
      effectiveStart: new Date(effectiveStart).toISOString(),
      effectiveEnd: new Date(effectiveEnd).toISOString(),
      durationMs,
      running: session.endedAt === null && current < end,
    });
    totalMs += durationMs;

    let client = clients.get(session.clientId);
    if (!client) {
      client = { clientId: session.clientId, name: session.clientName, durationMs: 0, tasks: [] };
      clients.set(session.clientId, client);
    }
    client.durationMs += durationMs;
    let task = tasks.get(session.taskId);
    if (!task) {
      task = {
        taskId: session.taskId,
        externalKey: session.externalKey,
        title: session.taskTitle,
        durationMs: 0,
      };
      tasks.set(session.taskId, task);
      client.tasks.push(task);
    }
    task.durationMs += durationMs;
  }

  const byDuration = (a: { durationMs: number; name?: string; title?: string; clientId?: string; taskId?: string },
    b: { durationMs: number; name?: string; title?: string; clientId?: string; taskId?: string }) =>
    b.durationMs - a.durationMs ||
    (a.name ?? a.title ?? "").localeCompare(b.name ?? b.title ?? "") ||
    (a.clientId ?? a.taskId ?? "").localeCompare(b.clientId ?? b.taskId ?? "");
  const orderedClients = [...clients.values()].sort(byDuration);
  for (const client of orderedClients) client.tasks.sort(byDuration);
  timeline.sort((a, b) => a.effectiveStart.localeCompare(b.effectiveStart) ||
    a.workSessionId.localeCompare(b.workSessionId));
  return { totalMs, clients: orderedClients, timeline };
}

export const todayService = { listWorkSessionsOverlapping };

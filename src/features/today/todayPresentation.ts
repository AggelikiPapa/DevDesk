import type { TodayReport } from "../../services/application/todayService.ts";

export interface TodayDisplayedDurations {
  totalMs: number;
  clients: Map<string, number>;
  tasks: Map<string, number>;
  sessions: Map<string, number>;
}

// Round each visible session down once, then sum those same displayed seconds.
export function todayDisplayedDurations(report: TodayReport): TodayDisplayedDurations {
  const displayed: TodayDisplayedDurations = {
    totalMs: 0,
    clients: new Map(),
    tasks: new Map(),
    sessions: new Map(),
  };
  for (const entry of report.timeline) {
    const milliseconds = Math.floor(entry.durationMs / 1000) * 1000;
    displayed.totalMs += milliseconds;
    displayed.clients.set(entry.clientId, (displayed.clients.get(entry.clientId) ?? 0) + milliseconds);
    displayed.tasks.set(entry.taskId, (displayed.tasks.get(entry.taskId) ?? 0) + milliseconds);
    displayed.sessions.set(entry.workSessionId, milliseconds);
  }
  return displayed;
}

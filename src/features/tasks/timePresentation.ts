import { calculateRecordedDuration } from "../../services/application/calculateRecordedDuration.ts";
import type { Task, WorkSession } from "../../types/domain.ts";

export type TimeAction = "start" | "pause" | "switch" | null;

export function timeActionForTask(task: Task, activeSession: WorkSession | null): TimeAction {
  if (task.status === "DONE") return null;
  if (activeSession?.taskId === task.id) return task.status === "WORKING" ? "pause" : null;
  if (task.status === "WORKING") return null;
  return activeSession ? "switch" : "start";
}

export function timeActionLabel(task: Task, action: TimeAction): string | null {
  if (action === "pause") return "Pause";
  if (action === "switch") return "Switch to this task";
  if (action === "start") return task.status === "NEW" ? "Start" : "Resume";
  return null;
}

export function canArchiveTask(task: Task, activeSession: WorkSession | null): boolean {
  return task.status !== "WORKING" && activeSession?.taskId !== task.id;
}

export function formatDuration(milliseconds: number): string {
  if (!Number.isFinite(milliseconds) || milliseconds < 0) {
    throw new RangeError("Recorded task time is invalid.");
  }
  const totalSeconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
}

export function taskDurationLabel(
  sessions: readonly WorkSession[],
  active: boolean,
  now?: string,
): string {
  return formatDuration(calculateRecordedDuration(sessions, active ? now : undefined));
}

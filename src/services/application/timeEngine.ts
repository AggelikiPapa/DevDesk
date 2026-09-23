import { invoke } from "@tauri-apps/api/core";
import type { Task, TaskId, WorkSession } from "../../types/domain.ts";

export interface StartTaskResult {
  task: Task;
  activeSession: WorkSession;
}

export interface PauseTaskResult {
  task: Task;
  closedSession: WorkSession;
}

export interface SwitchTaskResult {
  pausedTask: Task;
  activeTask: Task;
  closedSession: WorkSession;
  activeSession: WorkSession;
}

export interface CompleteTaskResult {
  task: Task;
  closedSession: WorkSession;
}

export interface TimeEngine {
  startTask(taskId: TaskId): Promise<StartTaskResult>;
  pauseTask(taskId: TaskId): Promise<PauseTaskResult>;
  switchTask(targetTaskId: TaskId): Promise<SwitchTaskResult>;
  completeActiveTask(taskId: TaskId): Promise<CompleteTaskResult>;
}

export class TimeEngineError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "TimeEngineError";
    this.code = code;
  }
}

type NativeInvoker = <T>(command: string, args?: Record<string, unknown>) => Promise<T>;

export function createTimeEngine(nativeInvoke: NativeInvoker = invoke): TimeEngine {
  return {
    startTask(taskId) {
      return invokeTimeCommand(nativeInvoke, "start_task", { taskId });
    },

    pauseTask(taskId) {
      return invokeTimeCommand(nativeInvoke, "pause_task", { taskId });
    },

    switchTask(targetTaskId) {
      return invokeTimeCommand(nativeInvoke, "switch_task", { targetTaskId });
    },

    completeActiveTask(taskId) {
      return invokeTimeCommand(nativeInvoke, "complete_active_task", { taskId });
    },
  };
}

async function invokeTimeCommand<T>(
  nativeInvoke: NativeInvoker,
  command: string,
  args: Record<string, unknown>,
): Promise<T> {
  try {
    return await nativeInvoke<T>(command, args);
  } catch (error) {
    throw toTimeEngineError(error);
  }
}

export function toTimeEngineError(error: unknown): TimeEngineError {
  if (isNativeTimeEngineError(error)) {
    return new TimeEngineError(error.code, error.message);
  }
  return new TimeEngineError(
    "TIME_ENGINE_ERROR",
    error instanceof Error ? error.message : "DevDesk could not complete the time operation.",
  );
}

function isNativeTimeEngineError(
  error: unknown,
): error is { code: string; message: string } {
  if (typeof error !== "object" || error === null) return false;
  const candidate = error as Record<string, unknown>;
  return typeof candidate.code === "string" && typeof candidate.message === "string";
}

export const timeEngine = createTimeEngine();

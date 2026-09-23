import type { Client, Task, TaskId, WorkSession } from "../../types/domain.ts";

export interface ClientOption {
  value: string;
  label: string;
}

export function clientOptions(clients: readonly Client[]): ClientOption[] {
  return clients.map((client) => ({
    value: client.id,
    label: client.displayName || client.name,
  }));
}

export function addTask(tasks: readonly Task[], task: Task): Task[] {
  return [task, ...tasks.filter((candidate) => candidate.id !== task.id)];
}

export function replaceTask(tasks: readonly Task[], task: Task): Task[] {
  return tasks.map((candidate) => candidate.id === task.id ? task : candidate);
}

export function removeTask(tasks: readonly Task[], taskId: TaskId): Task[] {
  return tasks.filter((task) => task.id !== taskId);
}

export function selectedTaskId(
  tasks: readonly Task[],
  preferredId: TaskId | null,
): TaskId | null {
  if (preferredId && tasks.some((task) => task.id === preferredId)) return preferredId;
  return tasks[0]?.id ?? null;
}

export function startupSelection(
  tasks: readonly Task[],
  activeSession: WorkSession | null,
): TaskId | null {
  return selectedTaskId(tasks, activeSession?.taskId ?? null);
}

export interface TimeWorkspaceState {
  tasks: Task[];
  activeSession: WorkSession | null;
  selection: TaskId | null;
  selectedSessions: { taskId: TaskId; sessions: WorkSession[] } | null;
}

export function applyStarted(
  state: TimeWorkspaceState,
  task: Task,
  activeSession: WorkSession,
): TimeWorkspaceState {
  return {
    tasks: replaceTask(state.tasks, task),
    activeSession,
    selection: task.id,
    selectedSessions: state.selectedSessions?.taskId === task.id
      ? {
          taskId: task.id,
          sessions: [...state.selectedSessions.sessions, activeSession],
        }
      : null,
  };
}

export function applyPausedOrCompleted(
  state: TimeWorkspaceState,
  task: Task,
  closedSession: WorkSession,
): TimeWorkspaceState {
  return {
    ...state,
    tasks: replaceTask(state.tasks, task),
    activeSession: null,
    selectedSessions: replaceSession(state.selectedSessions, closedSession),
  };
}

export function applySwitched(
  state: TimeWorkspaceState,
  pausedTask: Task,
  activeTask: Task,
  activeSession: WorkSession,
): TimeWorkspaceState {
  return {
    tasks: replaceTask(replaceTask(state.tasks, pausedTask), activeTask),
    activeSession,
    selection: activeTask.id,
    selectedSessions: state.selectedSessions?.taskId === activeTask.id
      ? {
          taskId: activeTask.id,
          sessions: [...state.selectedSessions.sessions, activeSession],
        }
      : null,
  };
}

function replaceSession(
  history: TimeWorkspaceState["selectedSessions"],
  session: WorkSession,
): TimeWorkspaceState["selectedSessions"] {
  if (history?.taskId !== session.taskId) return history;
  return {
    taskId: history.taskId,
    sessions: history.sessions.map((candidate) =>
      candidate.id === session.id ? session : candidate
    ),
  };
}

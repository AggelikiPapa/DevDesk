import type { Client, Task, TaskId } from "../../types/domain.ts";

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

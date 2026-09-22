export type ClientId = string;
export type TaskId = string;
export type WorkSessionId = string;
export type UtcTimestamp = string;

export interface Client {
  id: ClientId;
  name: string;
  displayName: string | null;
  createdAt: UtcTimestamp;
  updatedAt: UtcTimestamp;
}

export const TASK_STATUSES = [
  "NEW",
  "WORKING",
  "PAUSED",
  "WAITING_FOR_CLIENT",
  "WAITING_FOR_REVIEW",
  "DONE",
] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];

export interface Task {
  id: TaskId;
  clientId: ClientId;
  externalKey: string | null;
  title: string;
  status: TaskStatus;
  nextAction: string | null;
  createdAt: UtcTimestamp;
  updatedAt: UtcTimestamp;
  archivedAt: UtcTimestamp | null;
}

export interface WorkSession {
  id: WorkSessionId;
  taskId: TaskId;
  startedAt: UtcTimestamp;
  endedAt: UtcTimestamp | null;
  createdAt: UtcTimestamp;
}

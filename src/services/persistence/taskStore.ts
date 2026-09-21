import type { ClientId, Task, TaskStatus } from "../../types/domain";
import { getDatabase } from "./database";

interface TaskRow {
  id: string;
  client_id: string;
  external_key: string | null;
  title: string;
  status: TaskStatus;
  next_action: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

export interface CreateTaskInput {
  clientId: ClientId;
  externalKey?: string | null;
  title: string;
  status?: TaskStatus;
  nextAction?: string | null;
}

export async function createTask(input: CreateTaskInput): Promise<Task> {
  const database = await getDatabase();
  const now = new Date().toISOString();
  const task: Task = {
    id: crypto.randomUUID(),
    clientId: input.clientId,
    externalKey: input.externalKey?.trim() || null,
    title: input.title.trim(),
    status: input.status ?? "NEW",
    nextAction: input.nextAction?.trim() || null,
    createdAt: now,
    updatedAt: now,
    archivedAt: null,
  };

  await database.execute(
    `INSERT INTO tasks (
       id, client_id, external_key, title, status, next_action,
       created_at, updated_at, archived_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      task.id,
      task.clientId,
      task.externalKey,
      task.title,
      task.status,
      task.nextAction,
      task.createdAt,
      task.updatedAt,
      task.archivedAt,
    ],
  );

  return task;
}

export async function listActiveTasks(): Promise<Task[]> {
  const database = await getDatabase();
  const rows = await database.select<TaskRow[]>(
    `SELECT id, client_id, external_key, title, status, next_action,
            created_at, updated_at, archived_at
     FROM tasks
     WHERE archived_at IS NULL
     ORDER BY updated_at DESC, id`,
  );

  return rows.map(mapTask);
}

function mapTask(row: TaskRow): Task {
  return {
    id: row.id,
    clientId: row.client_id,
    externalKey: row.external_key,
    title: row.title,
    status: row.status,
    nextAction: row.next_action,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    archivedAt: row.archived_at,
  };
}

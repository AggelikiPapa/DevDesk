import type { ClientId, Task, TaskStatus } from "../../types/domain.ts";
import { getDatabase } from "./database.ts";

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

export interface TaskStore {
  createTask(input: CreateTaskInput): Promise<Task>;
  getTask(id: string): Promise<Task | null>;
  listActiveTasks(): Promise<Task[]>;
  updateTaskTitle(id: string, title: string, updatedAt: string): Promise<boolean>;
  updateTaskNextAction(id: string, nextAction: string | null, updatedAt: string): Promise<boolean>;
  updateTaskDetails(
    id: string,
    externalKey: string | null,
    title: string,
    nextAction: string | null,
    updatedAt: string,
  ): Promise<boolean>;
  changeTaskStatus(id: string, status: TaskStatus, updatedAt: string): Promise<boolean>;
  archiveTask(id: string, archivedAt: string): Promise<boolean>;
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

export async function getTask(id: string): Promise<Task | null> {
  const database = await getDatabase();
  const rows = await database.select<TaskRow[]>(
    `SELECT id, client_id, external_key, title, status, next_action,
            created_at, updated_at, archived_at
     FROM tasks
     WHERE id = $1
     LIMIT 1`,
    [id],
  );

  return rows[0] ? mapTask(rows[0]) : null;
}

export async function updateTaskTitle(
  id: string,
  title: string,
  updatedAt: string,
): Promise<boolean> {
  const database = await getDatabase();
  const result = await database.execute(
    `UPDATE tasks
     SET title = $1,
         updated_at = CASE
           WHEN updated_at < $2 THEN $2
           ELSE strftime('%Y-%m-%dT%H:%M:%fZ', updated_at, '+0.001 seconds')
         END
     WHERE id = $3`,
    [title, updatedAt, id],
  );
  return result.rowsAffected === 1;
}

export async function updateTaskNextAction(
  id: string,
  nextAction: string | null,
  updatedAt: string,
): Promise<boolean> {
  const database = await getDatabase();
  const result = await database.execute(
    `UPDATE tasks
     SET next_action = $1,
         updated_at = CASE
           WHEN updated_at < $2 THEN $2
           ELSE strftime('%Y-%m-%dT%H:%M:%fZ', updated_at, '+0.001 seconds')
         END
     WHERE id = $3`,
    [nextAction, updatedAt, id],
  );
  return result.rowsAffected === 1;
}

export async function updateTaskDetails(
  id: string,
  externalKey: string | null,
  title: string,
  nextAction: string | null,
  updatedAt: string,
): Promise<boolean> {
  const database = await getDatabase();
  const result = await database.execute(
    `UPDATE tasks
     SET external_key = $1,
         title = $2,
         next_action = $3,
         updated_at = CASE
           WHEN updated_at < $4 THEN $4
           ELSE strftime('%Y-%m-%dT%H:%M:%fZ', updated_at, '+0.001 seconds')
         END
     WHERE id = $5`,
    [externalKey, title, nextAction, updatedAt, id],
  );
  return result.rowsAffected === 1;
}

export async function changeTaskStatus(
  id: string,
  status: TaskStatus,
  updatedAt: string,
): Promise<boolean> {
  const database = await getDatabase();
  const result = await database.execute(
    `UPDATE tasks
     SET status = $1,
         updated_at = CASE
           WHEN updated_at < $2 THEN $2
           ELSE strftime('%Y-%m-%dT%H:%M:%fZ', updated_at, '+0.001 seconds')
         END
     WHERE id = $3
       AND $1 <> 'WORKING'
       AND status <> 'WORKING'
       AND NOT EXISTS (
         SELECT 1 FROM work_sessions
         WHERE ended_at IS NULL AND task_id = tasks.id
       )`,
    [status, updatedAt, id],
  );
  return result.rowsAffected === 1;
}

export async function archiveTask(id: string, archivedAt: string): Promise<boolean> {
  const database = await getDatabase();
  const result = await database.execute(
    `UPDATE tasks
     SET archived_at = CASE
           WHEN updated_at < $1 THEN $1
           ELSE strftime('%Y-%m-%dT%H:%M:%fZ', updated_at, '+0.001 seconds')
         END,
         updated_at = CASE
           WHEN updated_at < $1 THEN $1
           ELSE strftime('%Y-%m-%dT%H:%M:%fZ', updated_at, '+0.001 seconds')
         END
     WHERE id = $2
       AND status <> 'WORKING'
       AND NOT EXISTS (
         SELECT 1 FROM work_sessions
         WHERE ended_at IS NULL AND task_id = tasks.id
       )`,
    [archivedAt, id],
  );
  return result.rowsAffected === 1;
}

export const taskStore: TaskStore = {
  archiveTask,
  changeTaskStatus,
  createTask,
  getTask,
  listActiveTasks,
  updateTaskNextAction,
  updateTaskDetails,
  updateTaskTitle,
};

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

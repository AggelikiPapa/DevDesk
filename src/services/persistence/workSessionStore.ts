import type {
  TaskId,
  UtcTimestamp,
  WorkSession,
  WorkSessionId,
} from "../../types/domain.ts";
import { getDatabase } from "./database.ts";

interface WorkSessionRow {
  id: string;
  task_id: string;
  started_at: string;
  ended_at: string | null;
  created_at: string;
}

export interface CreateWorkSessionInput {
  taskId: TaskId;
  startedAt?: UtcTimestamp;
}

export interface WorkSessionStore {
  createWorkSession(input: CreateWorkSessionInput): Promise<WorkSession>;
  getWorkSession(id: WorkSessionId): Promise<WorkSession | null>;
  getActiveWorkSession(): Promise<WorkSession | null>;
  listWorkSessionsForTask(taskId: TaskId): Promise<WorkSession[]>;
  closeWorkSession(id: WorkSessionId, endedAt: UtcTimestamp): Promise<WorkSession>;
}

export type WorkSessionCloseErrorCode =
  | "WORK_SESSION_NOT_FOUND"
  | "WORK_SESSION_ALREADY_CLOSED"
  | "INVALID_END_TIME";

export class WorkSessionCloseError extends Error {
  readonly code: WorkSessionCloseErrorCode;

  constructor(code: WorkSessionCloseErrorCode, message: string) {
    super(message);
    this.name = "WorkSessionCloseError";
    this.code = code;
  }
}

export class ActiveWorkSessionInvariantError extends Error {
  readonly code = "ACTIVE_WORK_SESSION_INVARIANT";

  constructor() {
    super("Multiple active work sessions were found.");
    this.name = "ActiveWorkSessionInvariantError";
  }
}

export async function createWorkSession(
  input: CreateWorkSessionInput,
): Promise<WorkSession> {
  const database = await getDatabase();
  const now = new Date().toISOString();
  const session: WorkSession = {
    id: crypto.randomUUID(),
    taskId: input.taskId,
    startedAt: input.startedAt ?? now,
    endedAt: null,
    createdAt: now,
  };

  await database.execute(
    `INSERT INTO work_sessions (id, task_id, started_at, ended_at, created_at)
     VALUES ($1, $2, $3, NULL, $4)`,
    [session.id, session.taskId, session.startedAt, session.createdAt],
  );
  return session;
}

export async function getWorkSession(
  id: WorkSessionId,
): Promise<WorkSession | null> {
  const database = await getDatabase();
  const rows = await database.select<WorkSessionRow[]>(
    `SELECT id, task_id, started_at, ended_at, created_at
     FROM work_sessions
     WHERE id = $1
     LIMIT 1`,
    [id],
  );
  return rows[0] ? mapWorkSession(rows[0]) : null;
}

export async function getActiveWorkSession(): Promise<WorkSession | null> {
  const database = await getDatabase();
  const rows = await database.select<WorkSessionRow[]>(
    `SELECT id, task_id, started_at, ended_at, created_at
     FROM work_sessions
     WHERE ended_at IS NULL`,
  );
  if (rows.length > 1) throw new ActiveWorkSessionInvariantError();
  return rows[0] ? mapWorkSession(rows[0]) : null;
}

export async function listWorkSessionsForTask(taskId: TaskId): Promise<WorkSession[]> {
  const database = await getDatabase();
  const rows = await database.select<WorkSessionRow[]>(
    `SELECT id, task_id, started_at, ended_at, created_at
     FROM work_sessions
     WHERE task_id = $1
     ORDER BY started_at, id`,
    [taskId],
  );
  return rows.map(mapWorkSession);
}

export async function closeWorkSession(
  id: WorkSessionId,
  endedAt: UtcTimestamp,
): Promise<WorkSession> {
  const database = await getDatabase();
  const result = await database.execute(
    `UPDATE work_sessions
     SET ended_at = $1
     WHERE id = $2
       AND ended_at IS NULL
       AND started_at <= $1`,
    [endedAt, id],
  );

  if (result.rowsAffected === 1) {
    const closed = await getWorkSession(id);
    if (closed) return closed;
  }

  const session = await getWorkSession(id);
  throw workSessionCloseFailure(id, session);
}

export const workSessionStore: WorkSessionStore = {
  closeWorkSession,
  createWorkSession,
  getActiveWorkSession,
  getWorkSession,
  listWorkSessionsForTask,
};

export function workSessionCloseFailure(
  id: WorkSessionId,
  session: WorkSession | null,
): WorkSessionCloseError {
  if (!session) {
    return new WorkSessionCloseError(
      "WORK_SESSION_NOT_FOUND",
      `WorkSession not found: ${id}`,
    );
  }
  if (session.endedAt) {
    return new WorkSessionCloseError(
      "WORK_SESSION_ALREADY_CLOSED",
      `WorkSession is already closed: ${id}`,
    );
  }
  return new WorkSessionCloseError(
    "INVALID_END_TIME",
    "WorkSession end time must be at or after its start time.",
  );
}

function mapWorkSession(row: WorkSessionRow): WorkSession {
  return {
    id: row.id,
    taskId: row.task_id,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    createdAt: row.created_at,
  };
}

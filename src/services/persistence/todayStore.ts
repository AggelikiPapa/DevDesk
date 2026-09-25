import { getDatabase } from "./database.ts";
import type { TodaySessionRecord } from "../../types/reporting.ts";

interface TodayRow {
  work_session_id: string;
  task_id: string;
  client_id: string;
  client_name: string;
  external_key: string | null;
  task_title: string;
  started_at: string;
  ended_at: string | null;
}

export const OVERLAPPING_SESSIONS_SQL = `
  SELECT ws.id AS work_session_id, ws.task_id, t.client_id,
         COALESCE(c.display_name, c.name) AS client_name,
         t.external_key, t.title AS task_title, ws.started_at, ws.ended_at
  FROM work_sessions AS ws
  JOIN tasks AS t ON t.id = ws.task_id
  JOIN clients AS c ON c.id = t.client_id
  WHERE ws.started_at < $2
    AND (ws.ended_at IS NULL OR ws.ended_at > $1)
  ORDER BY ws.started_at, ws.id`;

export async function listWorkSessionsOverlapping(
  start: string,
  end: string,
): Promise<TodaySessionRecord[]> {
  const database = await getDatabase();
  const rows = await database.select<TodayRow[]>(OVERLAPPING_SESSIONS_SQL, [start, end]);
  return rows.map((row) => ({
    workSessionId: row.work_session_id,
    taskId: row.task_id,
    clientId: row.client_id,
    clientName: row.client_name,
    externalKey: row.external_key,
    taskTitle: row.task_title,
    startedAt: row.started_at,
    endedAt: row.ended_at,
  }));
}

export interface TodaySessionRecord {
  workSessionId: string;
  taskId: string;
  clientId: string;
  clientName: string;
  externalKey: string | null;
  taskTitle: string;
  startedAt: string;
  endedAt: string | null;
}

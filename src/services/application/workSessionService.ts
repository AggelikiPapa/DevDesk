import type { TaskId, UtcTimestamp, WorkSession } from "../../types/domain.ts";
import type { TaskApplicationService } from "./taskService.ts";
import { taskService } from "./taskService.ts";
import { calculateRecordedDuration } from "./calculateRecordedDuration.ts";
import {
  workSessionStore,
  type WorkSessionStore,
} from "../persistence/workSessionStore.ts";

export interface WorkSessionApplicationService {
  getActiveSession(): Promise<WorkSession | null>;
  getTaskSessions(taskId: TaskId): Promise<WorkSession[]>;
  getTaskRecordedDuration(taskId: TaskId, now?: UtcTimestamp): Promise<number>;
}

export function createWorkSessionApplicationService(
  store: WorkSessionStore = workSessionStore,
  tasks: Pick<TaskApplicationService, "getTask"> = taskService,
): WorkSessionApplicationService {
  async function getTaskSessions(taskId: TaskId): Promise<WorkSession[]> {
    await tasks.getTask(taskId);
    return store.listWorkSessionsForTask(taskId);
  }

  return {
    getActiveSession() {
      return store.getActiveWorkSession();
    },

    getTaskSessions,

    async getTaskRecordedDuration(taskId, now) {
      return calculateRecordedDuration(await getTaskSessions(taskId), now);
    },
  };
}

export const workSessionService = createWorkSessionApplicationService();

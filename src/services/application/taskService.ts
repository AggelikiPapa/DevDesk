import type { ClientId, Task, TaskStatus } from "../../types/domain.ts";
import type { ClientApplicationService } from "./clientService.ts";
import { clientService } from "./clientService.ts";
import { EntityNotFoundError } from "./errors.ts";
import { currentTimestamp, optionalText, requiredText, requireTaskStatus } from "./rules.ts";
import {
  taskStore,
  type TaskStore,
} from "../persistence/taskStore.ts";

export interface CreateTaskInput {
  clientId: ClientId;
  externalKey?: string | null;
  title: string;
  status?: TaskStatus;
  nextAction?: string | null;
}

export interface UpdateTaskDetailsInput {
  externalKey?: string | null;
  title: string;
  nextAction?: string | null;
}

export interface TaskApplicationService {
  createTask(input: CreateTaskInput): Promise<Task>;
  getTask(id: string): Promise<Task>;
  listActiveTasks(): Promise<Task[]>;
  updateTaskTitle(id: string, title: string): Promise<Task>;
  updateTaskNextAction(id: string, nextAction: string | null): Promise<Task>;
  updateTaskDetails(id: string, input: UpdateTaskDetailsInput): Promise<Task>;
  changeTaskStatus(id: string, status: TaskStatus): Promise<Task>;
  archiveTask(id: string): Promise<Task>;
}

export function createTaskApplicationService(
  store: TaskStore = taskStore,
  clients: Pick<ClientApplicationService, "getClient"> = clientService,
): TaskApplicationService {
  async function getTask(id: string): Promise<Task> {
    const task = await store.getTask(id);
    if (!task) throw new EntityNotFoundError("Task", id);
    return task;
  }

  async function finishMutation(id: string, changed: boolean): Promise<Task> {
    if (!changed) throw new EntityNotFoundError("Task", id);
    return getTask(id);
  }

  return {
    async createTask(input) {
      await clients.getClient(input.clientId);
      return store.createTask({
        clientId: input.clientId,
        externalKey: optionalText(input.externalKey),
        title: requiredText(input.title, "Task title"),
        status: requireTaskStatus(input.status ?? "NEW"),
        nextAction: optionalText(input.nextAction),
      });
    },

    getTask,

    listActiveTasks() {
      return store.listActiveTasks();
    },

    async updateTaskTitle(id, title) {
      const changed = await store.updateTaskTitle(
        id,
        requiredText(title, "Task title"),
        currentTimestamp(),
      );
      return finishMutation(id, changed);
    },

    async updateTaskNextAction(id, nextAction) {
      const changed = await store.updateTaskNextAction(
        id,
        optionalText(nextAction),
        currentTimestamp(),
      );
      return finishMutation(id, changed);
    },

    async updateTaskDetails(id, input) {
      const changed = await store.updateTaskDetails(
        id,
        optionalText(input.externalKey),
        requiredText(input.title, "Task title"),
        optionalText(input.nextAction),
        currentTimestamp(),
      );
      return finishMutation(id, changed);
    },

    async changeTaskStatus(id, status) {
      const changed = await store.changeTaskStatus(
        id,
        requireTaskStatus(status),
        currentTimestamp(),
      );
      return finishMutation(id, changed);
    },

    async archiveTask(id) {
      const changed = await store.archiveTask(id, currentTimestamp());
      return finishMutation(id, changed);
    },
  };
}

export const taskService = createTaskApplicationService();

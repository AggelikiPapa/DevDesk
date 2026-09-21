import { useEffect, useMemo, useState } from "react";
import { clientService, type CreateClientInput } from "../../services/application/clientService.ts";
import {
  taskService,
  type CreateTaskInput,
  type UpdateTaskDetailsInput,
} from "../../services/application/taskService.ts";
import type { Client, Task, TaskId } from "../../types/domain.ts";
import { addTask, removeTask, replaceTask, selectedTaskId } from "./workspaceState.ts";

export function useTaskWorkspace() {
  const [clients, setClients] = useState<Client[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selection, setSelection] = useState<TaskId | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([clientService.listClients(), taskService.listActiveTasks()])
      .then(([loadedClients, loadedTasks]) => {
        if (!active) return;
        setClients(loadedClients);
        setTasks(loadedTasks);
        setSelection((current) => selectedTaskId(loadedTasks, current));
      })
      .catch((error: unknown) => {
        if (active) setLoadError(errorMessage(error));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const selectedTask = useMemo(
    () => tasks.find((task) => task.id === selection) ?? null,
    [selection, tasks],
  );

  return {
    clients,
    tasks,
    selectedTask,
    selectedTaskId: selection,
    loading,
    loadError,
    selectTask: setSelection,

    async createClient(input: CreateClientInput) {
      const client = await clientService.createClient(input);
      setClients((current) => [...current, client]);
      return client;
    },

    async createTask(input: CreateTaskInput) {
      const task = await taskService.createTask({ ...input, status: "NEW" });
      setTasks((current) => addTask(current, task));
      setSelection(task.id);
      return task;
    },

    async updateTask(taskId: TaskId, input: UpdateTaskDetailsInput) {
      const task = await taskService.updateTaskDetails(taskId, input);
      setTasks((current) => replaceTask(current, task));
      return task;
    },

    async completeTask(taskId: TaskId) {
      const task = await taskService.changeTaskStatus(taskId, "DONE");
      setTasks((current) => replaceTask(current, task));
      return task;
    },

    async archiveTask(taskId: TaskId) {
      await taskService.archiveTask(taskId);
      const remaining = removeTask(tasks, taskId);
      setTasks(remaining);
      setSelection((selected) => selectedTaskId(remaining, selected));
    },
  };
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "DevDesk could not complete that action.";
}

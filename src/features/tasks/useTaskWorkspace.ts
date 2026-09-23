import { useEffect, useMemo, useRef, useState } from "react";
import { clientService, type CreateClientInput } from "../../services/application/clientService.ts";
import {
  taskService,
  type CreateTaskInput,
  type UpdateTaskDetailsInput,
} from "../../services/application/taskService.ts";
import { timeEngine } from "../../services/application/timeEngine.ts";
import { workSessionService } from "../../services/application/workSessionService.ts";
import type { Client, TaskId } from "../../types/domain.ts";
import {
  addTask,
  applyPausedOrCompleted,
  applyStarted,
  applySwitched,
  removeTask,
  replaceTask,
  selectedTaskId,
  startupSelection,
  type TimeWorkspaceState,
} from "./workspaceState.ts";
import { taskDurationLabel } from "./timePresentation.ts";
import { reorderTasks } from "./reorderTasks.ts";

const initialState: TimeWorkspaceState = {
  tasks: [],
  activeSession: null,
  selection: null,
  selectedSessions: null,
};

export function useTaskWorkspace() {
  const [clients, setClients] = useState<Client[]>([]);
  const [workspace, setWorkspace] = useState<TimeWorkspaceState>(initialState);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [historyVersion, setHistoryVersion] = useState(0);
  const [now, setNow] = useState(() => new Date().toISOString());
  const [timeBusy, setTimeBusy] = useState(false);
  const timeOperationInFlight = useRef(false);

  useEffect(() => {
    let mounted = true;
    Promise.all([
      clientService.listClients(),
      taskService.listActiveTasks(),
      workSessionService.getActiveSession(),
    ])
      .then(([loadedClients, loadedTasks, activeSession]) => {
        if (!mounted) return;
        setClients(loadedClients);
        setWorkspace({
          tasks: loadedTasks,
          activeSession,
          selection: startupSelection(loadedTasks, activeSession),
          selectedSessions: null,
        });
        if (activeSession && !loadedTasks.some((task) =>
          task.id === activeSession.taskId && task.status === "WORKING"
        )) {
          setLoadError("The active timer and task state do not match. No changes were made.");
        }
      })
      .catch((error: unknown) => {
        if (mounted) setLoadError(errorMessage(error));
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (loading || !workspace.selection) return;
    let mounted = true;
    const taskId = workspace.selection;
    setSessionError(null);
    workSessionService.getTaskSessions(taskId)
      .then((sessions) => {
        if (mounted) {
          setWorkspace((current) => ({
            ...current,
            selectedSessions: current.selection === taskId
              ? { taskId, sessions }
              : current.selectedSessions,
          }));
        }
      })
      .catch((error: unknown) => {
        if (mounted) setSessionError(errorMessage(error));
      });
    return () => { mounted = false; };
  }, [loading, workspace.selection, historyVersion]);

  const selectedTask = useMemo(
    () => workspace.tasks.find((task) => task.id === workspace.selection) ?? null,
    [workspace.selection, workspace.tasks],
  );
  const selectedIsActive = Boolean(
    selectedTask && workspace.activeSession?.taskId === selectedTask.id,
  );

  useEffect(() => {
    if (!selectedIsActive) return;
    setNow(new Date().toISOString());
    const interval = window.setInterval(() => setNow(new Date().toISOString()), 1000);
    return () => window.clearInterval(interval);
  }, [selectedIsActive, workspace.activeSession?.id]);

  let duration: string | null = null;
  let durationError: string | null = null;
  if (selectedTask && workspace.selectedSessions?.taskId === selectedTask.id) {
    try {
      duration = taskDurationLabel(
        workspace.selectedSessions.sessions,
        selectedIsActive,
        now,
      );
    } catch (error) {
      durationError = errorMessage(error);
    }
  }

  async function runTimeOperation<T>(operation: () => Promise<T>): Promise<T> {
    if (timeOperationInFlight.current) {
      throw new Error("A time operation is already in progress.");
    }
    timeOperationInFlight.current = true;
    setTimeBusy(true);
    try {
      return await operation();
    } finally {
      timeOperationInFlight.current = false;
      setTimeBusy(false);
    }
  }

  return {
    clients,
    tasks: workspace.tasks,
    selectedTask,
    selectedTaskId: workspace.selection,
    activeSession: workspace.activeSession,
    activeTask: workspace.tasks.find((task) => task.id === workspace.activeSession?.taskId) ?? null,
    duration,
    durationError: sessionError || durationError,
    timeBusy,
    loading,
    loadError,
    selectTask(taskId: TaskId) {
      setWorkspace((current) => ({ ...current, selection: taskId }));
    },

    async reorderTasks(sourceId: TaskId, targetId: TaskId) {
      const reordered = reorderTasks(workspace.tasks, sourceId, targetId);
      if (reordered.every((task, index) => task.id === workspace.tasks[index]?.id)) return;
      await taskService.reorderTasks(reordered.map((task) => task.id));
      setWorkspace((current) => {
        const byId = new Map(current.tasks.map((task) => [task.id, task]));
        return {
          ...current,
          tasks: [
            ...reordered.map((task) => byId.get(task.id) ?? task),
            ...current.tasks.filter((task) => !reordered.some((item) => item.id === task.id)),
          ],
        };
      });
    },

    async createClient(input: CreateClientInput) {
      const client = await clientService.createClient(input);
      setClients((current) => [...current, client]);
      return client;
    },

    async createTask(input: CreateTaskInput) {
      const task = await taskService.createTask({ ...input, status: "NEW" });
      setWorkspace((current) => ({
        ...current,
        tasks: addTask(current.tasks, task),
        selection: task.id,
      }));
      return task;
    },

    async updateTask(taskId: TaskId, input: UpdateTaskDetailsInput) {
      const task = await taskService.updateTaskDetails(taskId, input);
      setWorkspace((current) => ({ ...current, tasks: replaceTask(current.tasks, task) }));
      return task;
    },

    async startOrSwitchTask(taskId: TaskId) {
      return runTimeOperation(async () => {
        if (workspace.activeSession) {
          const result = await timeEngine.switchTask(taskId);
          setWorkspace((current) => applySwitched(
            current,
            result.pausedTask,
            result.activeTask,
            result.activeSession,
          ));
        } else {
          const result = await timeEngine.startTask(taskId);
          setWorkspace((current) => applyStarted(current, result.task, result.activeSession));
        }
        setNow(new Date().toISOString());
        setHistoryVersion((current) => current + 1);
      });
    },

    async pauseTask(taskId: TaskId) {
      return runTimeOperation(async () => {
        const result = await timeEngine.pauseTask(taskId);
        setWorkspace((current) => applyPausedOrCompleted(
          current,
          result.task,
          result.closedSession,
        ));
        setHistoryVersion((current) => current + 1);
      });
    },

    async completeTask(taskId: TaskId) {
      if (workspace.activeSession?.taskId === taskId) {
        return runTimeOperation(async () => {
          const result = await timeEngine.completeActiveTask(taskId);
          setWorkspace((current) => applyPausedOrCompleted(
            current,
            result.task,
            result.closedSession,
          ));
          setHistoryVersion((current) => current + 1);
          return result.task;
        });
      }
      const task = await taskService.changeTaskStatus(taskId, "DONE");
      setWorkspace((current) => ({ ...current, tasks: replaceTask(current.tasks, task) }));
      return task;
    },

    async reopenTask(taskId: TaskId) {
      const task = await taskService.reopenTask(taskId);
      setWorkspace((current) => ({ ...current, tasks: replaceTask(current.tasks, task) }));
      return task;
    },

    async archiveTask(taskId: TaskId) {
      await taskService.archiveTask(taskId);
      setWorkspace((current) => {
        const remaining = removeTask(current.tasks, taskId);
        return {
          ...current,
          tasks: remaining,
          selection: selectedTaskId(remaining, current.selection),
        };
      });
    },
  };
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "DevDesk could not complete that action.";
}

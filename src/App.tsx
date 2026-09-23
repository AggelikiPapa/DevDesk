import { useState } from "react";
import { BottomNavigation } from "./components/BottomNavigation";
import { CurrentTask } from "./components/CurrentTask";
import { EditTaskForm } from "./components/EditTaskForm";
import { TaskList } from "./components/TaskList";
import { FormDialog, TaskForm } from "./components/TaskForm";
import { clientLabel } from "./features/tasks/taskPresentation.ts";
import { errorMessage, useTaskWorkspace } from "./features/tasks/useTaskWorkspace.ts";

export default function App() {
  const workspace = useTaskWorkspace();
  const [form, setForm] = useState<"add" | "edit" | "archive" | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [reorderBusy, setReorderBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  async function changeSelectedTimer() {
    if (!workspace.selectedTask) return;
    setActionError(null);
    try {
      if (workspace.activeSession?.taskId === workspace.selectedTask.id) {
        await workspace.pauseTask(workspace.selectedTask.id);
      } else {
        await workspace.startOrSwitchTask(workspace.selectedTask.id);
      }
    } catch (error) {
      setActionError(errorMessage(error));
    }
  }

  async function completeSelectedTask() {
    if (!workspace.selectedTask) return;
    setActionBusy(true);
    setActionError(null);
    try {
      await workspace.completeTask(workspace.selectedTask.id);
    } catch (error) {
      setActionError(errorMessage(error));
    } finally {
      setActionBusy(false);
    }
  }

  async function reopenSelectedTask() {
    if (!workspace.selectedTask) return;
    setActionBusy(true);
    setActionError(null);
    try {
      await workspace.reopenTask(workspace.selectedTask.id);
    } catch (error) {
      setActionError(errorMessage(error));
    } finally {
      setActionBusy(false);
    }
  }

  async function archiveSelectedTask() {
    if (!workspace.selectedTask) return;
    setActionBusy(true);
    setActionError(null);
    try {
      await workspace.archiveTask(workspace.selectedTask.id);
      setForm(null);
    } catch (error) {
      setActionError(errorMessage(error));
    } finally {
      setActionBusy(false);
    }
  }

  return (
    <div className="app-shell">
      <main>
        {workspace.loading ? (
          <p className="loading-state" role="status">Loading tasks…</p>
        ) : (
          <>
            {(workspace.loadError || actionError || workspace.durationError) && (
              <p className="app-error" role="alert">
                {workspace.loadError || actionError || workspace.durationError}
              </p>
            )}
            {workspace.selectedTask && (
              <CurrentTask
                task={workspace.selectedTask}
                clientName={clientLabel(workspace.clients, workspace.selectedTask.clientId)}
                activeSession={workspace.activeSession}
                activeTaskLabel={workspace.activeTask?.externalKey || workspace.activeTask?.title || null}
                duration={workspace.duration}
                busy={actionBusy || workspace.timeBusy}
                onEdit={() => setForm("edit")}
                onTimeAction={() => { void changeSelectedTimer(); }}
                onComplete={() => { void completeSelectedTask(); }}
                onReopen={() => { void reopenSelectedTask(); }}
                onArchive={() => setForm("archive")}
              />
            )}
            <TaskList
              tasks={workspace.tasks}
              clients={workspace.clients}
              selectedTaskId={workspace.selectedTaskId}
              onSelect={(taskId) => {
                setActionError(null);
                workspace.selectTask(taskId);
              }}
              onAdd={() => setForm("add")}
              reorderBusy={reorderBusy}
              onReorder={async (sourceId, targetId) => {
                setReorderBusy(true);
                setActionError(null);
                try {
                  await workspace.reorderTasks(sourceId, targetId);
                } catch (error) {
                  setActionError(errorMessage(error));
                  throw error;
                } finally {
                  setReorderBusy(false);
                }
              }}
            />
          </>
        )}
      </main>
      <BottomNavigation />
      {form === "add" && (
        <TaskForm
          clients={workspace.clients}
          onCancel={() => setForm(null)}
          onCreateClient={workspace.createClient}
          onCreateTask={async (input) => {
            await workspace.createTask(input);
            setForm(null);
          }}
        />
      )}
      {form === "edit" && workspace.selectedTask && (
        <EditTaskForm
          task={workspace.selectedTask}
          onCancel={() => setForm(null)}
          onSave={async (input) => {
            await workspace.updateTask(workspace.selectedTask!.id, input);
            setForm(null);
          }}
        />
      )}
      {form === "archive" && workspace.selectedTask && (
        <FormDialog title="Archive task?" onCancel={() => setForm(null)}>
          <p className="confirm-copy">
            “{workspace.selectedTask.title}” will disappear from the active task list.
          </p>
          {actionError && <p className="form-error" role="alert">{actionError}</p>}
          <div className="form-actions">
            <button type="button" autoFocus onClick={() => setForm(null)} disabled={actionBusy}>
              Cancel
            </button>
            <button
              type="button"
              className="danger-confirm"
              disabled={actionBusy}
              onClick={() => { void archiveSelectedTask(); }}
            >
              Archive
            </button>
          </div>
        </FormDialog>
      )}
    </div>
  );
}

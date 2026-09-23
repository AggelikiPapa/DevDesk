import type { Task } from "../types/domain.ts";
import { formatStatus } from "../features/tasks/taskPresentation.ts";
import {
  canArchiveTask,
  timeActionForTask,
  timeActionLabel,
} from "../features/tasks/timePresentation.ts";
import type { WorkSession } from "../types/domain.ts";

interface CurrentTaskProps {
  task: Task;
  clientName: string;
  activeSession: WorkSession | null;
  activeTaskLabel: string | null;
  duration: string | null;
  busy: boolean;
  onEdit: () => void;
  onTimeAction: () => void;
  onComplete: () => void;
  onReopen: () => void;
  onArchive: () => void;
}

export function CurrentTask({
  task,
  clientName,
  activeSession,
  activeTaskLabel,
  duration,
  busy,
  onEdit,
  onTimeAction,
  onComplete,
  onReopen,
  onArchive,
}: CurrentTaskProps) {
  const timeAction = timeActionForTask(task, activeSession);
  const timeActionText = timeActionLabel(task, timeAction);
  return (
    <section className="current-task" aria-labelledby="selected-task-heading">
      <div className="section-heading">
        <h2 id="selected-task-heading">Selected task</h2>
        <span className="status">{formatStatus(task.status)}</span>
      </div>
      <div className="task-identity">
        <span className="client">{clientName}</span>
        {task.externalKey && <span className="issue-key">{task.externalKey}</span>}
      </div>
      <h3>{task.title}</h3>
      <div className="next-action">
        <span className="eyebrow">Next action</span>
        <p>{task.nextAction || "No next action"}</p>
      </div>
      {activeTaskLabel && activeSession?.taskId !== task.id && (
        <p className="active-task-hint">Currently timing: {activeTaskLabel}</p>
      )}
      <div className="task-timer" role="timer" aria-label="Recorded task time">
        {duration ?? "Loading time…"}
      </div>
      <div className="task-controls" role="group" aria-label="Task actions">
        <button type="button" onClick={onEdit} disabled={busy}>Edit</button>
        {timeActionText && (
          <button type="button" className="primary" onClick={onTimeAction} disabled={busy}>
            {timeActionText}
          </button>
        )}
        {task.status !== "DONE" && (
          <button type="button" onClick={onComplete} disabled={busy}>
            Complete
          </button>
        )}
        {task.status === "DONE" && (
          <button type="button" className="primary" onClick={onReopen} disabled={busy}>
            Reopen
          </button>
        )}
        {canArchiveTask(task, activeSession) && (
          <button type="button" className="danger" onClick={onArchive} disabled={busy}>
            Archive
          </button>
        )}
      </div>
    </section>
  );
}

import type { Task } from "../types/domain.ts";
import { formatStatus } from "../features/tasks/taskPresentation.ts";

interface CurrentTaskProps {
  task: Task;
  clientName: string;
  busy: boolean;
  onEdit: () => void;
  onComplete: () => void;
  onArchive: () => void;
}

export function CurrentTask({
  task,
  clientName,
  busy,
  onEdit,
  onComplete,
  onArchive,
}: CurrentTaskProps) {
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
      <div className="task-controls" role="group" aria-label="Task actions">
        <button type="button" onClick={onEdit} disabled={busy}>Edit</button>
        {task.status !== "DONE" && (
          <button type="button" className="primary" onClick={onComplete} disabled={busy}>
            Complete
          </button>
        )}
        <button type="button" className="danger" onClick={onArchive} disabled={busy}>
          Archive
        </button>
      </div>
    </section>
  );
}

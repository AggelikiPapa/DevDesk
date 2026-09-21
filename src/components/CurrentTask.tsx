import type { CurrentTaskPreview } from "../types/task-preview";
import { PreviewButton } from "./PreviewButton";

export function CurrentTask({ task }: { task: CurrentTaskPreview }) {
  const [hours, minutes] = task.elapsedTime.split(":");
  return (
    <section className="current-task" aria-labelledby="current-task-heading">
      <div className="section-heading">
        <h2 id="current-task-heading">Current task</h2>
        <span className="status">{task.status}</span>
      </div>
      <div className="task-identity">
        <span className="client">{task.client}</span>
        <span className="issue-key">{task.issueKey}</span>
      </div>
      <h3>{task.title}</h3>
      <div className="next-action">
        <span className="eyebrow">Next action</span>
        <p>{task.nextAction}</p>
      </div>
      <div className="timer">
        <span className="elapsed-time" aria-label={`Elapsed time (hours, minutes): ${hours}:${minutes}`}>
          {hours}:{minutes}
        </span>
        <span className="timer-caption">Elapsed · sample</span>
      </div>
      <div className="task-controls" role="group" aria-label="Task actions (preview)">
        <PreviewButton primary>Resume</PreviewButton>
        <PreviewButton>Complete</PreviewButton>
      </div>
    </section>
  );
}

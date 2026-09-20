import type { TaskPreview } from "../types/task-preview";

export function TaskList({ tasks }: { tasks: TaskPreview[] }) {
  return (
    <section className="other-tasks" aria-labelledby="other-tasks-heading">
      <div className="section-heading">
        <h2 id="other-tasks-heading">Other tasks</h2>
        <button type="button" className="add-task" aria-label="Add task" aria-disabled="true"
          title="Unavailable in this visual preview">+</button>
      </div>
      <ul className="task-list">
        {tasks.map((task) => (
          <li key={task.issueKey}>
            <button type="button" className="task-row" aria-disabled="true" title="Unavailable in this visual preview">
              <span className="row-meta">
                <span className="issue-key">{task.issueKey}</span>
                <span className="row-client">{task.client}</span>
                <span className="status">{task.status}</span>
              </span>
              <span className="row-title">{task.title}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

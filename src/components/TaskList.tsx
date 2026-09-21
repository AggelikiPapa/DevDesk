import type { Client, Task, TaskId } from "../types/domain.ts";
import { clientLabel, formatStatus } from "../features/tasks/taskPresentation.ts";

interface TaskListProps {
  tasks: Task[];
  clients: Client[];
  selectedTaskId: TaskId | null;
  onSelect: (taskId: TaskId) => void;
  onAdd: () => void;
}

export function TaskList({ tasks, clients, selectedTaskId, onSelect, onAdd }: TaskListProps) {
  return (
    <section className="other-tasks" aria-labelledby="tasks-heading">
      <div className="section-heading">
        <h2 id="tasks-heading">Tasks</h2>
        <button type="button" className="add-task" aria-label="Add task" onClick={onAdd}>+</button>
      </div>
      {tasks.length === 0 ? (
        <div className="empty-state">
          <h3>No tasks yet</h3>
          <p>Add your first task to start organizing your work.</p>
          <button type="button" className="primary" onClick={onAdd}>+ Add task</button>
        </div>
      ) : (
        <ul className="task-list">
          {tasks.map((task) => (
            <li key={task.id}>
              <button
                type="button"
                className={`task-row${selectedTaskId === task.id ? " selected" : ""}`}
                aria-pressed={selectedTaskId === task.id}
                onClick={() => onSelect(task.id)}
              >
                <span className="row-meta">
                  {task.externalKey && <span className="issue-key">{task.externalKey}</span>}
                  <span className="row-client">{clientLabel(clients, task.clientId)}</span>
                  <span className="status">{formatStatus(task.status)}</span>
                </span>
                <span className="row-title">{task.title}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

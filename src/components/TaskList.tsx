import { useState } from "react";
import type { TaskPreview } from "../types/task-preview";

interface TaskListProps {
  tasks: TaskPreview[];
  onReorder: (sourceKey: string, targetKey: string) => void;
}

export function TaskList({ tasks, onReorder }: TaskListProps) {
  const [draggedKey, setDraggedKey] = useState<string | null>(null);
  const [dropKey, setDropKey] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");

  function move(sourceKey: string, targetKey: string) {
    const position = tasks.findIndex((task) => task.issueKey === targetKey);
    if (position < 0 || sourceKey === targetKey) return;
    onReorder(sourceKey, targetKey);
    setAnnouncement(`${sourceKey} moved to position ${position + 1} of ${tasks.length}.`);
  }

  function clearDrag() {
    setDraggedKey(null);
    setDropKey(null);
  }

  return (
    <section className="other-tasks" aria-labelledby="other-tasks-heading">
      <div className="section-heading">
        <h2 id="other-tasks-heading">Other tasks</h2>
        <button type="button" className="add-task" aria-label="Add task" aria-disabled="true"
          title="Unavailable in this visual preview">+</button>
      </div>
      <p id="reorder-help" className="sr-only">Drag to reorder, or focus a task's move handle and use the Up and Down arrow keys.</p>
      <p className="sr-only" role="status">{announcement}</p>
      <ul className="task-list">
        {tasks.map((task, index) => (
          <li key={task.issueKey}
            className={`task-list-item${dropKey === task.issueKey ? " drop-target" : ""}`}
            onDragOver={(event) => {
              if (!draggedKey) return;
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
              setDropKey(task.issueKey);
            }}
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropKey(null);
            }}
            onDrop={(event) => {
              event.preventDefault();
              if (draggedKey) move(draggedKey, task.issueKey);
              clearDrag();
            }}>
            <button type="button" className="move-task" draggable
              aria-label={`Move ${task.issueKey}`} aria-describedby="reorder-help"
              title="Drag to reorder · use ↑ or ↓ when focused"
              onDragStart={(event) => {
                setDraggedKey(task.issueKey);
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", task.issueKey);
              }}
              onDragEnd={clearDrag}
              onKeyDown={(event) => {
                if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
                event.preventDefault();
                const target = tasks[index + (event.key === "ArrowUp" ? -1 : 1)];
                if (target) move(task.issueKey, target.issueKey);
              }}>
              <span aria-hidden="true">⠿</span>
            </button>
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

import { useState } from "react";
import type { Client, Task, TaskId } from "../types/domain.ts";
import { clientLabel, formatStatus } from "../features/tasks/taskPresentation.ts";

interface TaskListProps {
  tasks: Task[];
  clients: Client[];
  selectedTaskId: TaskId | null;
  onSelect: (taskId: TaskId) => void;
  onAdd: () => void;
  onReorder: (sourceId: TaskId, targetId: TaskId) => Promise<void>;
  reorderBusy: boolean;
}

export function TaskList({ tasks, clients, selectedTaskId, onSelect, onAdd, onReorder, reorderBusy }: TaskListProps) {
  const [draggedId, setDraggedId] = useState<TaskId | null>(null);
  const [dropId, setDropId] = useState<TaskId | null>(null);
  const [announcement, setAnnouncement] = useState("");

  function move(sourceId: TaskId, targetId: TaskId) {
    const position = tasks.findIndex((task) => task.id === targetId);
    if (position < 0 || sourceId === targetId || reorderBusy) return;
    void onReorder(sourceId, targetId)
      .then(() => setAnnouncement(`Task moved to position ${position + 1} of ${tasks.length}.`))
      .catch(() => {});
  }

  function clearDrag() {
    setDraggedId(null);
    setDropId(null);
  }

  return (
    <section className="other-tasks" aria-labelledby="tasks-heading">
      <div className="section-heading">
        <h2 id="tasks-heading">Tasks</h2>
        <button type="button" className="add-task" aria-label="Add task" onClick={onAdd}>+</button>
      </div>
      <p id="reorder-help" className="sr-only">Drag a task's move handle to reorder, or focus it and use the Up and Down arrow keys.</p>
      <p className="sr-only" role="status">{announcement}</p>
      {tasks.length === 0 ? (
        <div className="empty-state">
          <h3>No tasks yet</h3>
          <p>Add your first task to start organizing your work.</p>
          <button type="button" className="primary" onClick={onAdd}>+ Add task</button>
        </div>
      ) : (
        <ul className="task-list"
          onPointerMove={(event) => {
            if (!draggedId || reorderBusy) return;
            const item = (event.target as Element).closest<HTMLLIElement>("li[data-task-id]");
            setDropId(item?.dataset.taskId ?? null);
          }}
          onPointerUp={(event) => {
            if (draggedId) {
              const item = (event.target as Element).closest<HTMLLIElement>("li[data-task-id]");
              if (item?.dataset.taskId) move(draggedId, item.dataset.taskId);
            }
            clearDrag();
          }}
          onPointerLeave={clearDrag}
          onPointerCancel={clearDrag}>
          {tasks.map((task, index) => (
            <li key={task.id}
              data-task-id={task.id}
              className={`task-list-item${dropId === task.id && draggedId !== task.id ? " drop-target" : ""}`}>
              <button type="button" className="move-task"
                disabled={reorderBusy}
                aria-label={`Move ${task.externalKey || task.title}`}
                aria-describedby="reorder-help"
                title="Drag to reorder · use ↑ or ↓ when focused"
                onPointerDown={(event) => {
                  event.preventDefault();
                  setDraggedId(task.id);
                }}
                onKeyDown={(event) => {
                  if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
                  event.preventDefault();
                  const target = tasks[index + (event.key === "ArrowUp" ? -1 : 1)];
                  if (target) move(task.id, target.id);
                }}>
                <span aria-hidden="true">⠿</span>
              </button>
              <button
                type="button"
                className={`task-row${selectedTaskId === task.id ? " selected" : ""}${task.status === "WORKING" ? " working" : ""}`}
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

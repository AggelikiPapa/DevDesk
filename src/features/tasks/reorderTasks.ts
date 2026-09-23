import type { Task, TaskId } from "../../types/domain.ts";

export function reorderTasks(
  tasks: readonly Task[],
  sourceId: TaskId,
  targetId: TaskId,
): Task[] {
  const source = tasks.findIndex((task) => task.id === sourceId);
  const target = tasks.findIndex((task) => task.id === targetId);
  const reordered = [...tasks];
  if (source < 0 || target < 0 || source === target) return reordered;
  const [moved] = reordered.splice(source, 1);
  reordered.splice(target, 0, moved);
  return reordered;
}

import type { TaskPreview } from "../../types/task-preview";

// Move to the target's position without mutating the current list or its tasks.
export function reorderTasks(tasks: readonly TaskPreview[], sourceKey: string, targetKey: string): TaskPreview[] {
  const source = tasks.findIndex((task) => task.issueKey === sourceKey);
  const target = tasks.findIndex((task) => task.issueKey === targetKey);
  const reordered = [...tasks];
  if (source < 0 || target < 0 || source === target) return reordered;
  const [moved] = reordered.splice(source, 1);
  reordered.splice(target, 0, moved);
  return reordered;
}

import type { CurrentTaskPreview, TaskPreview } from "../../types/task-preview";

// Replace these fixtures when real task data is introduced.
export const currentTask: CurrentTaskPreview = {
  client: "Enerwave",
  issueKey: "ENW-142",
  title: "Update contract generation logic",
  status: "Paused",
  nextAction: "Check AccountService null handling",
  elapsedTime: "01:24:36",
};

export const otherTasks: TaskPreview[] = [
  { client: "Kerun", issueKey: "KER-87", title: "Fix validation rule", status: "Paused" },
  { client: "Enerwave", issueKey: "ENW-156", title: "Investigate billing issue", status: "Waiting for client" },
  { client: "ABC", issueKey: "ABC-42", title: "Update LWC component", status: "New" },
];

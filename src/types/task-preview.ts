// Display-only data for DD-003, not the future persisted Task model.
export interface TaskPreview {
  client: string;
  issueKey: string;
  title: string;
  status: string;
}

export interface CurrentTaskPreview extends TaskPreview {
  nextAction: string;
  elapsedTime: string;
}

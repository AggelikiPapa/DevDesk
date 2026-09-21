import { useState, type FormEvent } from "react";
import { errorMessage } from "../features/tasks/useTaskWorkspace.ts";
import type { UpdateTaskDetailsInput } from "../services/application/taskService.ts";
import type { Task } from "../types/domain.ts";
import { FormActions, FormDialog } from "./TaskForm.tsx";

export function EditTaskForm({ task, onCancel, onSave }: {
  task: Task;
  onCancel: () => void;
  onSave: (input: UpdateTaskDetailsInput) => Promise<unknown>;
}) {
  const [externalKey, setExternalKey] = useState(task.externalKey ?? "");
  const [title, setTitle] = useState(task.title);
  const [nextAction, setNextAction] = useState(task.nextAction ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onSave({ externalKey, title, nextAction });
    } catch (caught) {
      setError(errorMessage(caught));
      setBusy(false);
    }
  }

  return (
    <FormDialog title="Edit task" onCancel={onCancel}>
      {error && <p className="form-error" role="alert">{error}</p>}
      <form className="compact-form" onSubmit={submit}>
        <label>External key <span>(optional)</span>
          <input autoFocus value={externalKey} onChange={(event) => setExternalKey(event.target.value)} />
        </label>
        <label>Title
          <input required value={title} onChange={(event) => setTitle(event.target.value)} />
        </label>
        <label>Next action <span>(optional)</span>
          <textarea rows={3} value={nextAction} onChange={(event) => setNextAction(event.target.value)} />
        </label>
        <FormActions busy={busy} submitLabel="Save" onCancel={onCancel} />
      </form>
    </FormDialog>
  );
}

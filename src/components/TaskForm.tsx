import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { clientOptions } from "../features/tasks/workspaceState.ts";
import { errorMessage } from "../features/tasks/useTaskWorkspace.ts";
import type { CreateClientInput } from "../services/application/clientService.ts";
import type { CreateTaskInput } from "../services/application/taskService.ts";
import type { Client } from "../types/domain.ts";

interface TaskFormProps {
  clients: Client[];
  onCancel: () => void;
  onCreateClient: (input: CreateClientInput) => Promise<Client>;
  onCreateTask: (input: CreateTaskInput) => Promise<unknown>;
}

export function TaskForm({ clients, onCancel, onCreateClient, onCreateTask }: TaskFormProps) {
  const options = useMemo(() => clientOptions(clients), [clients]);
  const [clientId, setClientId] = useState(options[0]?.value ?? "");
  const [externalKey, setExternalKey] = useState("");
  const [title, setTitle] = useState("");
  const [nextAction, setNextAction] = useState("");
  const [showClientForm, setShowClientForm] = useState(options.length === 0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!showClientForm) titleRef.current?.focus();
  }, [showClientForm]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onCreateTask({ clientId, externalKey, title, nextAction, status: "NEW" });
    } catch (caught) {
      setError(errorMessage(caught));
      setBusy(false);
    }
  }

  async function createClient(input: CreateClientInput) {
    setBusy(true);
    setError(null);
    try {
      const client = await onCreateClient(input);
      setClientId(client.id);
      setShowClientForm(false);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <FormDialog title="Add task" onCancel={onCancel}>
      {error && <p className="form-error" role="alert">{error}</p>}
      {showClientForm ? (
        <ClientForm
          busy={busy}
          onCancel={options.length ? () => setShowClientForm(false) : undefined}
          onSubmit={createClient}
        />
      ) : (
        <form className="compact-form" onSubmit={submit}>
          <label>Client
            <select required value={clientId} onChange={(event) => setClientId(event.target.value)}>
              {options.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <button type="button" className="text-button" onClick={() => setShowClientForm(true)}>
            + New client
          </button>
          <label>External key <span>(optional)</span>
            <input value={externalKey} onChange={(event) => setExternalKey(event.target.value)} />
          </label>
          <label>Title
            <input ref={titleRef} required value={title} onChange={(event) => setTitle(event.target.value)} />
          </label>
          <label>Next action <span>(optional)</span>
            <textarea rows={2} value={nextAction} onChange={(event) => setNextAction(event.target.value)} />
          </label>
          <FormActions busy={busy} submitLabel="Add task" onCancel={onCancel} />
        </form>
      )}
    </FormDialog>
  );
}

function ClientForm({
  busy,
  onCancel,
  onSubmit,
}: {
  busy: boolean;
  onCancel?: () => void;
  onSubmit: (input: CreateClientInput) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [displayName, setDisplayName] = useState("");
  return (
    <form className="compact-form" onSubmit={(event) => {
      event.preventDefault();
      void onSubmit({ name, displayName });
    }}>
      <p className="form-hint">Create a client before adding the task.</p>
      <label>Name
        <input autoFocus required value={name} onChange={(event) => setName(event.target.value)} />
      </label>
      <label>Display name <span>(optional)</span>
        <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
      </label>
      <div className="form-actions">
        {onCancel && <button type="button" onClick={onCancel} disabled={busy}>Back</button>}
        <button type="submit" className="primary" disabled={busy}>Create client</button>
      </div>
    </form>
  );
}

export function FormDialog({ title, onCancel, children }: {
  title: string;
  onCancel: () => void;
  children: ReactNode;
}) {
  return (
    <div className="dialog-backdrop" onKeyDown={(event) => {
      if (event.key === "Escape") onCancel();
    }}>
      <section className="form-dialog" role="dialog" aria-modal="true" aria-labelledby="form-title">
        <div className="dialog-heading">
          <h2 id="form-title">{title}</h2>
          <button type="button" className="close-button" aria-label="Close" onClick={onCancel}>×</button>
        </div>
        {children}
      </section>
    </div>
  );
}

export function FormActions({ busy, submitLabel, onCancel }: {
  busy: boolean;
  submitLabel: string;
  onCancel: () => void;
}) {
  return (
    <div className="form-actions">
      <button type="button" onClick={onCancel} disabled={busy}>Cancel</button>
      <button type="submit" className="primary" disabled={busy}>{submitLabel}</button>
    </div>
  );
}

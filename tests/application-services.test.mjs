import assert from "node:assert/strict";
import test from "node:test";

import { createClientApplicationService } from "../src/services/application/clientService.ts";
import {
  EntityNotFoundError,
  ValidationError,
} from "../src/services/application/errors.ts";
import { createTaskApplicationService } from "../src/services/application/taskService.ts";

const initialTimestamp = "2026-01-01T00:00:00.000Z";

function createFixture() {
  const clients = new Map();
  const tasks = new Map();
  let clientSequence = 0;
  let taskSequence = 0;

  const clientStore = {
    async createClient(input) {
      const client = {
        id: `client-${++clientSequence}`,
        name: input.name,
        displayName: input.displayName ?? null,
        createdAt: initialTimestamp,
        updatedAt: initialTimestamp,
      };
      clients.set(client.id, client);
      return structuredClone(client);
    },
    async getClient(id) {
      return clients.has(id) ? structuredClone(clients.get(id)) : null;
    },
    async listClients() {
      return [...clients.values()].map((client) => structuredClone(client));
    },
  };

  const taskStore = {
    async createTask(input) {
      const task = {
        id: `task-${++taskSequence}`,
        clientId: input.clientId,
        externalKey: input.externalKey ?? null,
        title: input.title,
        status: input.status ?? "NEW",
        nextAction: input.nextAction ?? null,
        createdAt: initialTimestamp,
        updatedAt: initialTimestamp,
        archivedAt: null,
      };
      tasks.set(task.id, task);
      return structuredClone(task);
    },
    async getTask(id) {
      return tasks.has(id) ? structuredClone(tasks.get(id)) : null;
    },
    async listActiveTasks() {
      return [...tasks.values()]
        .filter((task) => task.archivedAt === null)
        .map((task) => structuredClone(task));
    },
    async updateTaskTitle(id, title, updatedAt) {
      return updateTaskWithTimestamp(id, { title }, updatedAt);
    },
    async updateTaskNextAction(id, nextAction, updatedAt) {
      return updateTaskWithTimestamp(id, { nextAction }, updatedAt);
    },
    async updateTaskDetails(id, externalKey, title, nextAction, updatedAt) {
      return updateTaskWithTimestamp(id, { externalKey, title, nextAction }, updatedAt);
    },
    async changeTaskStatus(id, status, updatedAt) {
      return updateTaskWithTimestamp(id, { status }, updatedAt);
    },
    async archiveTask(id, archivedAt) {
      const task = tasks.get(id);
      if (!task) return false;
      const timestamp = nextStoredTimestamp(task.updatedAt, archivedAt);
      tasks.set(id, { ...task, archivedAt: timestamp, updatedAt: timestamp });
      return true;
    },
  };

  function updateTask(id, changes) {
    const task = tasks.get(id);
    if (!task) return false;
    tasks.set(id, { ...task, ...changes });
    return true;
  }

  function updateTaskWithTimestamp(id, changes, proposedTimestamp) {
    const task = tasks.get(id);
    if (!task) return false;
    return updateTask(id, {
      ...changes,
      updatedAt: nextStoredTimestamp(task.updatedAt, proposedTimestamp),
    });
  }

  function nextStoredTimestamp(previous, proposed) {
    if (proposed > previous) return proposed;
    return new Date(Date.parse(previous) + 1).toISOString();
  }

  const clientService = createClientApplicationService(clientStore);
  const taskService = createTaskApplicationService(taskStore, clientService);

  return { clientService, taskService, clients, tasks };
}

async function createClientAndTask(fixture, overrides = {}) {
  const client = await fixture.clientService.createClient({ name: "Acme" });
  const task = await fixture.taskService.createTask({
    clientId: client.id,
    title: "Initial task",
    ...overrides,
  });
  return { client, task };
}

test("creates, gets, and lists clients through the application service", async () => {
  const fixture = createFixture();
  const created = await fixture.clientService.createClient({
    name: "  acme  ",
    displayName: "  Acme Corp  ",
  });

  assert.equal(created.name, "acme");
  assert.equal(created.displayName, "Acme Corp");
  assert.deepEqual(await fixture.clientService.getClient(created.id), created);
  assert.deepEqual(await fixture.clientService.listClients(), [created]);
});

test("creates and gets a task with normalized text", async () => {
  const fixture = createFixture();
  const { task } = await createClientAndTask(fixture, {
    externalKey: "  ENW-142  ",
    title: "  Update contract logic  ",
    nextAction: "  Check null handling  ",
  });

  assert.equal(task.externalKey, "ENW-142");
  assert.equal(task.title, "Update contract logic");
  assert.equal(task.nextAction, "Check null handling");
  assert.deepEqual(await fixture.taskService.getTask(task.id), task);
});

test("rejects missing clients and empty task titles", async () => {
  const fixture = createFixture();

  await assert.rejects(
    fixture.taskService.createTask({ clientId: "missing", title: "Task" }),
    (error) => error instanceof EntityNotFoundError && error.code === "ENTITY_NOT_FOUND",
  );

  const client = await fixture.clientService.createClient({ name: "Acme" });
  await assert.rejects(
    fixture.taskService.createTask({ clientId: client.id, title: "   " }),
    (error) => error instanceof ValidationError && error.code === "VALIDATION_ERROR",
  );
});

test("updates and trims a task title and advances updatedAt", async () => {
  const fixture = createFixture();
  const { task } = await createClientAndTask(fixture);
  const updated = await fixture.taskService.updateTaskTitle(task.id, "  Revised task  ");

  assert.equal(updated.title, "Revised task");
  assert.ok(updated.updatedAt > task.updatedAt);
  await assert.rejects(
    fixture.taskService.updateTaskTitle(task.id, "\t  "),
    ValidationError,
  );
});

test("updates next action and stores whitespace-only input as null", async () => {
  const fixture = createFixture();
  const { task } = await createClientAndTask(fixture);

  const withAction = await fixture.taskService.updateTaskNextAction(
    task.id,
    "  Ask for review  ",
  );
  assert.equal(withAction.nextAction, "Ask for review");

  const cleared = await fixture.taskService.updateTaskNextAction(task.id, "   ");
  assert.equal(cleared.nextAction, null);
  assert.ok(cleared.updatedAt > withAction.updatedAt);
});

test("atomically updates and normalizes editable task details", async () => {
  const fixture = createFixture();
  const { task } = await createClientAndTask(fixture);

  const updated = await fixture.taskService.updateTaskDetails(task.id, {
    externalKey: "  ENW-200  ",
    title: "  Revised details  ",
    nextAction: "   ",
  });

  assert.equal(updated.externalKey, "ENW-200");
  assert.equal(updated.title, "Revised details");
  assert.equal(updated.nextAction, null);
  assert.ok(updated.updatedAt > task.updatedAt);
});

test("persists valid statuses and rejects invalid statuses", async () => {
  const fixture = createFixture();
  const { task } = await createClientAndTask(fixture);

  const done = await fixture.taskService.changeTaskStatus(task.id, "DONE");
  assert.equal(done.status, "DONE");
  assert.equal(done.archivedAt, null);
  assert.deepEqual(await fixture.taskService.listActiveTasks(), [done]);

  await assert.rejects(
    fixture.taskService.changeTaskStatus(task.id, "INVALID"),
    ValidationError,
  );
});

test("archives without deleting or changing other task data", async () => {
  const fixture = createFixture();
  const { task } = await createClientAndTask(fixture, {
    status: "PAUSED",
    nextAction: "Wait for response",
  });
  const archived = await fixture.taskService.archiveTask(task.id);

  assert.ok(archived.archivedAt);
  assert.equal(archived.updatedAt, archived.archivedAt);
  assert.equal(archived.status, task.status);
  assert.equal(archived.title, task.title);
  assert.equal(archived.nextAction, task.nextAction);
  assert.deepEqual(await fixture.taskService.listActiveTasks(), []);
  assert.deepEqual(await fixture.taskService.getTask(task.id), archived);
});

test("fails clearly when mutating an unknown task", async () => {
  const fixture = createFixture();

  await assert.rejects(
    fixture.taskService.updateTaskTitle("missing", "New title"),
    (error) =>
      error instanceof EntityNotFoundError &&
      error.code === "ENTITY_NOT_FOUND" &&
      error.message === "Task not found: missing",
  );
});

export class ValidationError extends Error {
  readonly code = "VALIDATION_ERROR";

  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export class EntityNotFoundError extends Error {
  readonly code = "ENTITY_NOT_FOUND";

  constructor(entity: "Client" | "Task", id: string) {
    super(`${entity} not found: ${id}`);
    this.name = "EntityNotFoundError";
  }
}

import { TASK_STATUSES, type TaskStatus } from "../../types/domain.ts";
import { ValidationError } from "./errors.ts";

export function requiredText(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) throw new ValidationError(`${field} must not be empty.`);
  return normalized;
}

export function optionalText(value: string | null | undefined): string | null {
  return value?.trim() || null;
}

export function requireTaskStatus(value: unknown): TaskStatus {
  if (typeof value !== "string" || !TASK_STATUSES.includes(value as TaskStatus)) {
    throw new ValidationError(`Invalid task status: ${String(value)}`);
  }
  return value as TaskStatus;
}

export function currentTimestamp(): string {
  return new Date().toISOString();
}

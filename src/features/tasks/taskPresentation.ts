import type { Client, ClientId, TaskStatus } from "../../types/domain.ts";

export function clientLabel(clients: readonly Client[], clientId: ClientId): string {
  const client = clients.find((candidate) => candidate.id === clientId);
  return client?.displayName || client?.name || "Unknown client";
}

export function formatStatus(status: TaskStatus): string {
  return status
    .toLowerCase()
    .split("_")
    .map((word) => word[0]?.toUpperCase() + word.slice(1))
    .join(" ");
}

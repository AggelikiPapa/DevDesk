import type { Client } from "../../types/domain";
import { getDatabase } from "./database";

interface ClientRow {
  id: string;
  name: string;
  display_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateClientInput {
  name: string;
  displayName?: string | null;
}

export async function createClient(input: CreateClientInput): Promise<Client> {
  const database = await getDatabase();
  const now = new Date().toISOString();
  const client: Client = {
    id: crypto.randomUUID(),
    name: input.name.trim(),
    displayName: input.displayName?.trim() || null,
    createdAt: now,
    updatedAt: now,
  };

  await database.execute(
    `INSERT INTO clients (id, name, display_name, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [client.id, client.name, client.displayName, client.createdAt, client.updatedAt],
  );

  return client;
}

export async function listClients(): Promise<Client[]> {
  const database = await getDatabase();
  const rows = await database.select<ClientRow[]>(
    `SELECT id, name, display_name, created_at, updated_at
     FROM clients
     ORDER BY name COLLATE NOCASE, id`,
  );

  return rows.map(mapClient);
}

function mapClient(row: ClientRow): Client {
  return {
    id: row.id,
    name: row.name,
    displayName: row.display_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

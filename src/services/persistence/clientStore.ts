import type { Client } from "../../types/domain.ts";
import { getDatabase } from "./database.ts";

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

export interface ClientStore {
  createClient(input: CreateClientInput): Promise<Client>;
  getClient(id: string): Promise<Client | null>;
  listClients(): Promise<Client[]>;
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

export async function getClient(id: string): Promise<Client | null> {
  const database = await getDatabase();
  const rows = await database.select<ClientRow[]>(
    `SELECT id, name, display_name, created_at, updated_at
     FROM clients
     WHERE id = $1
     LIMIT 1`,
    [id],
  );

  return rows[0] ? mapClient(rows[0]) : null;
}

export const clientStore: ClientStore = {
  createClient,
  getClient,
  listClients,
};

function mapClient(row: ClientRow): Client {
  return {
    id: row.id,
    name: row.name,
    displayName: row.display_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

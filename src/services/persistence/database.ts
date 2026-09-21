import Database from "@tauri-apps/plugin-sql";

export const DATABASE_URL = "sqlite:devdesk.db";

let databasePromise: Promise<Database> | undefined;

export function getDatabase(): Promise<Database> {
  databasePromise ??= Database.load(DATABASE_URL);
  return databasePromise;
}

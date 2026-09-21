import type { Client } from "../../types/domain.ts";
import {
  clientStore,
  type ClientStore,
} from "../persistence/clientStore.ts";
import { EntityNotFoundError } from "./errors.ts";
import { optionalText, requiredText } from "./rules.ts";

export interface CreateClientInput {
  name: string;
  displayName?: string | null;
}

export interface ClientApplicationService {
  createClient(input: CreateClientInput): Promise<Client>;
  getClient(id: string): Promise<Client>;
  listClients(): Promise<Client[]>;
}

export function createClientApplicationService(
  store: ClientStore = clientStore,
): ClientApplicationService {
  return {
    createClient(input) {
      return store.createClient({
        name: requiredText(input.name, "Client name"),
        displayName: optionalText(input.displayName),
      });
    },

    async getClient(id) {
      const client = await store.getClient(id);
      if (!client) throw new EntityNotFoundError("Client", id);
      return client;
    },

    listClients() {
      return store.listClients();
    },
  };
}

export const clientService = createClientApplicationService();

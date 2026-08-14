import { Injectable } from '@angular/core';
import { FetchClient } from '@c8y/client';

export interface AiAgentDirectoryEntry {
  name: string;
  type?: string;
  availability?: string;
  /** The full, untouched entry as returned by the endpoint — for the config UI's "Selected" JSON preview. */
  raw: Record<string, unknown>;
}

/**
 * Lists the tenant's configured AI agents, for the config component's agent
 * picker and the main widget's agent-details header. Endpoint and response
 * shape (a plain JSON array of `{ name, type, availability, ... }`, no
 * envelope wrapper) confirmed directly from a live tenant
 * (GET /service/ai/agent) — not guessed.
 */
@Injectable({ providedIn: 'root' })
export class AiAgentDirectoryService {
  private cached: Promise<AiAgentDirectoryEntry[]> | null = null;

  constructor(private fetchClient: FetchClient) {}

  async listAgents(): Promise<AiAgentDirectoryEntry[]> {
    if (!this.cached) {
      this.cached = this.fetchAgents().catch((error) => {
        this.cached = null;
        throw error;
      });
    }
    return this.cached;
  }

  async findAgent(name: string): Promise<AiAgentDirectoryEntry | undefined> {
    if (!name) {
      return undefined;
    }
    const agents = await this.listAgents();
    return agents.find((agent) => agent.name === name);
  }

  private async fetchAgents(): Promise<AiAgentDirectoryEntry[]> {
    const response = await this.fetchClient.fetch('/service/ai/agent', {
      headers: { Accept: 'application/json' }
    });

    if (!response.ok) {
      throw new Error(`Failed to list AI agents (${response.status})`);
    }

    const data = (await response.json()) as unknown;
    if (!Array.isArray(data)) {
      return [];
    }

    return data
      .map((entry) => this.toDirectoryEntry(entry))
      .filter((entry): entry is AiAgentDirectoryEntry => !!entry);
  }

  private toDirectoryEntry(entry: unknown): AiAgentDirectoryEntry | null {
    if (!entry || typeof entry !== 'object') {
      return null;
    }
    const record = entry as Record<string, unknown>;
    const name = record['name'];
    if (typeof name !== 'string') {
      return null;
    }
    return {
      name,
      type: typeof record['type'] === 'string' ? (record['type'] as string) : undefined,
      availability: typeof record['availability'] === 'string' ? (record['availability'] as string) : undefined,
      raw: record
    };
  }
}

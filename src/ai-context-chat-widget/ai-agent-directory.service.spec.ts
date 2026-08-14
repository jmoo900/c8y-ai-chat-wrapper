import { TestBed } from '@angular/core/testing';
import { FetchClient } from '@c8y/client';

import { AiAgentDirectoryService } from './ai-agent-directory.service';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('AiAgentDirectoryService', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let service: AiAgentDirectoryService;

  beforeEach(() => {
    fetchMock = vi.fn();
    TestBed.configureTestingModule({
      providers: [AiAgentDirectoryService, { provide: FetchClient, useValue: { fetch: fetchMock } }]
    });
    service = TestBed.inject(AiAgentDirectoryService);
  });

  it('parses a valid array response, keeping the raw entry alongside the extracted fields', async () => {
    const rawEntry = { name: 'mi-ops-insights', type: 'text', availability: 'PRIVATE', agent: { system: '...' } };
    fetchMock.mockResolvedValue(jsonResponse([rawEntry]));

    const agents = await service.listAgents();

    expect(agents).toEqual([{ name: 'mi-ops-insights', type: 'text', availability: 'PRIVATE', raw: rawEntry }]);
    expect(fetchMock).toHaveBeenCalledWith('/service/ai/agent', { headers: { Accept: 'application/json' } });
  });

  it('filters out entries without a string name', async () => {
    fetchMock.mockResolvedValue(jsonResponse([{ type: 'text' }, { name: 'valid-agent' }, { name: 42 }]));

    const agents = await service.listAgents();

    expect(agents.map((a) => a.name)).toEqual(['valid-agent']);
  });

  it('leaves type/availability undefined when they are missing or not strings', async () => {
    fetchMock.mockResolvedValue(jsonResponse([{ name: 'agent-1', type: 123, availability: null }]));

    const [agent] = await service.listAgents();

    expect(agent.type).toBeUndefined();
    expect(agent.availability).toBeUndefined();
  });

  it('returns an empty array when the response body is not a JSON array', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ agents: [] }));

    expect(await service.listAgents()).toEqual([]);
  });

  it('throws when the response is not ok', async () => {
    fetchMock.mockResolvedValue(new Response('', { status: 500, statusText: 'Internal Server Error' }));

    await expect(service.listAgents()).rejects.toThrow('Failed to list AI agents (500)');
  });

  it('caches the result — a second call does not fetch again', async () => {
    fetchMock.mockResolvedValue(jsonResponse([{ name: 'agent-1' }]));

    await service.listAgents();
    await service.listAgents();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('clears the cache on failure, so the next call retries', async () => {
    fetchMock.mockResolvedValueOnce(new Response('', { status: 500, statusText: 'error' }));
    fetchMock.mockResolvedValueOnce(jsonResponse([{ name: 'agent-1' }]));

    await expect(service.listAgents()).rejects.toThrow();
    const agents = await service.listAgents();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(agents).toHaveLength(1);
  });

  describe('findAgent', () => {
    beforeEach(() => {
      fetchMock.mockResolvedValue(jsonResponse([{ name: 'agent-1' }, { name: 'agent-2' }]));
    });

    it('finds an agent by exact name', async () => {
      expect((await service.findAgent('agent-2'))?.name).toBe('agent-2');
    });

    it('returns undefined for a name that is not in the list', async () => {
      expect(await service.findAgent('does-not-exist')).toBeUndefined();
    });

    it('returns undefined without fetching for an empty name', async () => {
      expect(await service.findAgent('')).toBeUndefined();
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});

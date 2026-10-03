import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { AiwMcpServer } from '../../src/mcp/aiw-mcp-server';

describe('MCP reviewed proposal workflow', () => {
  let client: Client;
  let mcp: AiwMcpServer;
  const projectId = '2715f920-f86f-475e-864e-85862d8d64d7';
  const proposalId = '1942f626-7033-4d3b-b400-a571620738e5';

  beforeEach(async () => {
    mcp = new AiwMcpServer({
      apiUrl: 'http://localhost/api/v1',
      apiKey: 'test',
      defaultProjectIdOrKey: projectId,
    });
    client = new Client({ name: 'test', version: '1' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([mcp.server.connect(serverTransport), client.connect(clientTransport)]);
  });
  afterEach(async () => {
    await client.close();
    await mcp.server.close();
    jest.restoreAllMocks();
  });

  it('resolves a requirement key before generating an unconfirmed draft', async () => {
    const mock = jest.spyOn(global, 'fetch').mockImplementation(async (url, options) => {
      const parsed = new URL(String(url));
      if (parsed.pathname.endsWith('/requirements')) {
        expect(parsed.searchParams.get('number')).toBe('1');
        return new Response(JSON.stringify({ data: [{ id: 'req-uuid', number: 1 }] }));
      }
      expect(parsed.pathname).toContain('/ai/requirements/req-uuid/task-proposals');
      expect(options?.method).toBe('POST');
      return new Response(
        JSON.stringify({ id: proposalId, status: 'PENDING', resultRecordIds: [] }),
      );
    });
    const result = await client.callTool({
      name: 'generate_task_proposal',
      arguments: { requirementKeyOrId: 'AIW-REQ-1' },
    });
    expect(result.isError).not.toBe(true);
    expect(mock).toHaveBeenCalledTimes(2);
  });

  it('preserves selected-only confirmation and stable retry identity', async () => {
    const mock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ resultRecordIds: [] })));
    await client.callTool({
      name: 'confirm_ai_proposal',
      arguments: {
        proposalId,
        version: 2,
        selectedItemIds: [],
        includeSummary: true,
        idempotencyKey: 'retry-key',
        userConfirmed: true,
      },
    });
    const options = mock.mock.calls[0]![1]!;
    expect(options.headers).toMatchObject({ 'Idempotency-Key': 'retry-key' });
    expect(JSON.parse(options.body as string)).toEqual({
      version: 2,
      selectedItemIds: [],
      includeSummary: true,
    });
  });

  it('gets task detail after key resolution so confirmed source metadata reaches MCP', async () => {
    const taskId = '38ecf209-93a9-44c4-b28a-cf044261a82f';
    jest.spyOn(global, 'fetch').mockImplementation(async (url) => {
      const parsed = new URL(String(url));
      if (parsed.pathname.endsWith('/tasks')) {
        return new Response(JSON.stringify({ data: [{ id: taskId, number: 11 }] }));
      }
      expect(parsed.pathname).toBe(`/api/v1/projects/${projectId}/tasks/${taskId}`);
      return new Response(
        JSON.stringify({
          data: {
            id: taskId,
            aiProvenance: { proposalId, sourceReferences: [{ title: 'SRS', revision: 1 }] },
          },
        }),
      );
    });
    const result = await client.callTool({
      name: 'get_task',
      arguments: { taskKeyOrId: 'AIW-TASK-11' },
    });
    expect(result.isError).not.toBe(true);
    expect(JSON.stringify(result)).toContain('aiProvenance');
  });

  it('returns readable authorization errors and never bypasses the API', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(
        new Response(
          JSON.stringify({ error: { code: 'FORBIDDEN', message: 'Project access denied.' } }),
          { status: 403 },
        ),
      );
    const result = await client.callTool({ name: 'get_ai_proposal', arguments: { proposalId } });
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result)).toContain('Project access denied.');
  });
});

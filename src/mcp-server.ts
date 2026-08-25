import 'dotenv/config';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { tools } from './tools.js';

const server = new McpServer({
  name: 'db-diagnostic-agent',
  version: '0.1.0',
});

for (const tool of tools) {
  server.registerTool(
    tool.name,
    { title: tool.name, description: tool.description, inputSchema: tool.schema.shape },
    async (input) => {
      const result = await tool.execute(input);
      return { content: [{ type: 'text', text: result }] };
    },
  );
}

const transport = new StdioServerTransport();
await server.connect(transport);

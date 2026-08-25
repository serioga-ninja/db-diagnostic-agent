import { z } from 'zod';
import Anthropic from '@anthropic-ai/sdk';
import { getTableSchema, runExplainAnalyze } from './db.js';
import { searchCodebase } from './codeSearch.js';

interface Tool<TInput = any> {
  name: string;
  description: string;
  schema: z.ZodType<TInput>;
  execute: (input: TInput) => Promise<string>;
}

// helper just for type inference at call sites — no runtime behavior
function defineTool<TInput>(tool: Tool<TInput>): Tool<TInput> {
  return tool;
}

const querySchemaTool = defineTool({
  name: 'query_schema',
  description:
    'Get the schema of a database table: columns, existing indexes, and foreign keys. Use this first to understand table structure before analyzing a slow query.',
  schema: z.object({
    tableName: z.string().describe('Name of the table to inspect'),
  }),
  execute: async (input) => {
    const result = await getTableSchema(input.tableName);
    return JSON.stringify(result, null, 2);
  },
});

const runExplainTool = defineTool({
  name: 'run_explain',
  description:
    'Run EXPLAIN ANALYZE on a SELECT query to see the actual query plan, execution time, and whether indexes are used. Only SELECT statements are allowed.',
  schema: z.object({
    sql: z.string().describe('The SELECT query to analyze'),
  }),
  execute: async (input) => {
    const result = await runExplainAnalyze(input.sql);
    return JSON.stringify(result, null, 2);
  },
});

const searchCodebaseTool = defineTool({
  name: 'search_codebase',
  description:
    'Search the codebase for a text pattern (e.g. a table name, function name, or query fragment) to find where a query is triggered from in application code.',
  schema: z.object({
    pattern: z.string().describe('Text or regex pattern to search for'),
  }),
  execute: async (input) => {
    return await searchCodebase(input.pattern);
  },
});

// this is the ONLY place you touch to add a new tool
export const tools: Tool[] = [querySchemaTool, runExplainTool, searchCodebaseTool];

export const toolDefinitions: Anthropic.Tool[] = tools.map((tool) => ({
  name: tool.name,
  description: tool.description,
  input_schema: z.toJSONSchema(tool.schema) as Anthropic.Tool.InputSchema,
}));

export async function executeTool(name: string, rawInput: unknown): Promise<string> {
  const tool = tools.find((t) => t.name === name);
  if (!tool) {
    throw new Error(`Unknown tool: ${name}`);
  }
  const input = tool.schema.parse(rawInput); // validates AND gives typed input
  return tool.execute(input);
}

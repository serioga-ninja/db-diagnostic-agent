export type ToolDefinitions = unknown;


export const toolDefinitions = [
  {
    name: 'query_schema',
    description:
      'Get the schema of a database table: columns, existing indexes, and foreign keys. Use this first to understand table structure before analyzing a slow query.',
    input_schema: {
      type: 'object' as const,
      properties: {
        tableName: { type: 'string', description: 'Name of the table to inspect' },
      },
      required: ['tableName'],
    },
  },
  {
    name: 'run_explain',
    description:
      'Run EXPLAIN ANALYZE on a SELECT query to see the actual query plan, execution time, and whether indexes are used. Only SELECT statements are allowed.',
    input_schema: {
      type: 'object' as const,
      properties: {
        sql: { type: 'string', description: 'The SELECT query to analyze' },
      },
      required: ['sql'],
    },
  },
  {
    name: 'search_codebase',
    description:
      'Search the codebase for a text pattern (e.g. a table name, function name, or query fragment) to find where a query is triggered from in application code.',
    input_schema: {
      type: 'object' as const,
      properties: {
        pattern: { type: 'string', description: 'Text or regex pattern to search for' },
      },
      required: ['pattern'],
    },
  },
];

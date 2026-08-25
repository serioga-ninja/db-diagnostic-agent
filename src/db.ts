import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function getTableSchema(tableName: string) {
  const columns = await pool.query(
    `SELECT column_name, data_type, is_nullable
     FROM information_schema.columns
     WHERE table_name = $1`,
    [tableName],
  );

  const indexes = await pool.query(
    `SELECT indexname, indexdef
     FROM pg_indexes
     WHERE tablename = $1`,
    [tableName],
  );

  const foreignKeys = await pool.query(
    `SELECT
       tc.constraint_name, kcu.column_name,
       ccu.table_name AS foreign_table_name,
       ccu.column_name AS foreign_column_name
     FROM information_schema.table_constraints tc
     JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
     JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
     WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name = $1`,
    [tableName],
  );

  return {
    columns: columns.rows,
    indexes: indexes.rows,
    foreignKeys: foreignKeys.rows,
  };
}

export async function runExplainAnalyze(sql: string) {
  // safety: only allow SELECT for explain (this tool should never mutate data)
  if (!/^\s*select/i.test(sql)) {
    throw new Error('Only SELECT queries are allowed for EXPLAIN ANALYZE');
  }
  const result = await pool.query<{ 'QUERY PLAN': string }>(
    `EXPLAIN (ANALYZE, FORMAT JSON) ${sql}`,
  );
  return result.rows.at(0)?.['QUERY PLAN'];
}

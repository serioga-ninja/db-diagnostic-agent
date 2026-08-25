import 'dotenv/config';
import { readFileSync } from 'node:fs';
import Anthropic from '@anthropic-ai/sdk';
import { toolDefinitions, executeTool } from './tools.js';

const anthropic = new Anthropic();

const SYSTEM_PROMPT = `You are a database diagnostic agent. Your job is to investigate a slow or
problematic query and find the root cause, then give a concrete recommendation.

Process:
1. Understand the table structure involved (query_schema)
2. Run EXPLAIN ANALYZE on the query to see the actual execution plan (run_explain)
3. Form a hypothesis (e.g. "missing index on user_id causes a sequential scan")
4. If it would help, find where in the codebase this query is triggered from (search_codebase),
   so your recommendation can point to a specific file/location
5. Give a final, specific recommendation — not generic advice

Use tools as many times as needed. Stop investigating once you have enough information
to give a confident, specific recommendation — don't call tools unnecessarily.`;

async function runAgent(userQuery: string) {
  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: userQuery }];

  while (true) {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
      system: SYSTEM_PROMPT,
      tools: toolDefinitions,
      messages,
    });

    messages.push({ role: 'assistant', content: response.content });

    if (response.stop_reason !== 'tool_use') {
      // model is done — print final text response
      const textBlock = response.content.find((b) => b.type === 'text');
      if (textBlock && textBlock.type === 'text') {
        console.log('\n=== Final report ===\n');
        console.log(textBlock.text);
      }
      break;
    }

    // model wants to use tool(s) — execute each and feed results back
    const toolUseBlocks = response.content.filter((b) => b.type === 'tool_use');
    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const block of toolUseBlocks) {
      console.log(`\n🔧 Calling tool: ${block.name}(${JSON.stringify(block.input)})`);
      try {
        const result = await executeTool(block.name, block.input);
        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: result,
        });
      } catch (err) {
        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: `Error: ${(err as Error).message}`,
          is_error: true,
        });
      }
    }

    messages.push({ role: 'user', content: toolResults });
  }
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString('utf-8').trim();
}

function printUsage() {
  console.error('Usage: tsx src/index.ts "why is the orders query slow?"');
  console.error('   or: tsx src/index.ts --file query.txt');
  console.error('   or: cat query.txt | tsx src/index.ts');
}

async function resolveQuery(): Promise<string> {
  const args = process.argv.slice(2);
  const fileFlagIndex = args.findIndex((a) => a === '--file' || a === '-f');

  if (fileFlagIndex !== -1) {
    const filePath = args[fileFlagIndex + 1];
    if (!filePath) {
      console.error('Error: --file requires a path argument');
      process.exit(1);
    }
    return readFileSync(filePath, 'utf-8').trim();
  }

  if (args[0]) {
    return args[0];
  }

  if (!process.stdin.isTTY) {
    const stdinQuery = await readStdin();
    if (stdinQuery) return stdinQuery;
  }

  printUsage();
  process.exit(1);
}

const query = await resolveQuery();
await runAgent(query);

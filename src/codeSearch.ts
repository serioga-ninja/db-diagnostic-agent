import fs from 'fs/promises';
import path from 'path';

const IGNORED_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next']);

async function* walkFiles(dir: string): AsyncGenerator<string> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (IGNORED_DIRS.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walkFiles(fullPath);
    } else if (/\.(ts|js|tsx|jsx)$/.test(entry.name)) {
      yield fullPath;
    }
  }
}

export async function searchCodebase(pattern: string, rootDir: string = '.'): Promise<string> {
  const regex = new RegExp(pattern, 'i');
  const matches: string[] = [];

  for await (const filePath of walkFiles(rootDir)) {
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n');

    lines.forEach((line, i) => {
      if (regex.test(line)) {
        const start = Math.max(0, i - 1);
        const end = Math.min(lines.length, i + 2);
        const context = lines.slice(start, end).join('\n');
        matches.push(`${filePath}:${i + 1}\n${context}`);
      }
    });
  }

  return matches.length > 0 ? matches.join('\n\n---\n\n') : 'No matches found.';
}

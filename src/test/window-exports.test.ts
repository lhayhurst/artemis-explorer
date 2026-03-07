/**
 * Regression tests for window-exposed functions.
 *
 * Every onclick="fn()" in index.html must appear in the Object.assign(window, {...})
 * call in main.ts. This test parses both files and cross-checks them so a new
 * UI function can never silently go missing from the window object.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '../..');

function readFile(rel: string): string {
  return readFileSync(resolve(ROOT, rel), 'utf-8');
}

const JS_KEYWORDS = new Set(['if', 'else', 'for', 'while', 'do', 'return', 'new', 'typeof', 'void', 'delete', 'this', 'true', 'false', 'null', 'undefined']);

/** Extract all bare function names from onclick="…" and onchange="…" attributes in HTML. */
function htmlOnHandlers(html: string): string[] {
  const names = new Set<string>();
  // match onclick="foo(…)", onchange="foo(…)", oninput="foo(…)" – capture every call-site identifier
  for (const m of html.matchAll(/on(?:click|change|input)="([^"]+)"/g)) {
    const expr = m[1]!;
    // Only top-level calls: identifier followed by '(' but NOT preceded by '.'
    for (const call of expr.matchAll(/(?<![.\w])([a-zA-Z_$][\w$]*)\s*\(/g)) {
      const name = call[1]!;
      if (!JS_KEYWORDS.has(name)) names.add(name);
    }
  }
  return [...names].sort();
}

/** Extract all keys from the Object.assign(window, { … }) block in main.ts. */
function windowExports(ts: string): string[] {
  const block = ts.match(/Object\.assign\(window,\s*\{([\s\S]*?)\}\s*\)/)?.[1] ?? '';
  const names = new Set<string>();
  for (const m of block.matchAll(/\b([a-zA-Z_$][\w$]*)\b/g)) {
    names.add(m[1]!);
  }
  return [...names].sort();
}

describe('window exports vs HTML onclick handlers', () => {
  const html = readFile('index.html');
  const ts = readFile('src/main.ts');

  const handlers = htmlOnHandlers(html);
  const exported = windowExports(ts);

  it('every onclick/onchange handler in index.html is exported on window', () => {
    const missing = handlers.filter(fn => !exported.includes(fn));
    expect(missing, `Functions used in HTML but missing from Object.assign(window): ${missing.join(', ')}`).toEqual([]);
  });
});

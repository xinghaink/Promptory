import type { Variable } from './types';

/**
 * Template syntax:
 *   {{名称}}    a variable the user fills in
 *   {{@名称}}   a built-in variable filled automatically (see BUILTINS)
 */
const TOKEN = /\{\{\s*(@?)([^{}]+?)\s*\}\}/g;

export const BUILTINS = {
  剪贴板: '剪贴板内容',
  选中文本: '网页中选中的文本',
  今天: '今天的日期',
  现在: '当前日期和时间',
} as const;

export type BuiltinName = keyof typeof BUILTINS;

export function isBuiltin(name: string): name is BuiltinName {
  return Object.prototype.hasOwnProperty.call(BUILTINS, name);
}

export type Segment =
  | { kind: 'text'; text: string }
  | { kind: 'var'; name: string; builtin: boolean; raw: string };

/** Splits a template into literal text and variable tokens, in order. */
export function parseTemplate(content: string): Segment[] {
  const segments: Segment[] = [];
  let last = 0;
  for (const m of content.matchAll(TOKEN)) {
    const start = m.index ?? 0;
    if (start > last) segments.push({ kind: 'text', text: content.slice(last, start) });
    segments.push({ kind: 'var', name: m[2], builtin: m[1] === '@', raw: m[0] });
    last = start + m[0].length;
  }
  if (last < content.length) segments.push({ kind: 'text', text: content.slice(last) });
  return segments;
}

/** Names of user-filled variables, in order of first appearance. */
export function extractVariableNames(content: string): string[] {
  const names: string[] = [];
  for (const seg of parseTemplate(content)) {
    if (seg.kind === 'var' && !seg.builtin && !names.includes(seg.name)) names.push(seg.name);
  }
  return names;
}

/** Names of built-in variables used by the template. */
export function extractBuiltinNames(content: string): BuiltinName[] {
  const names: BuiltinName[] = [];
  for (const seg of parseTemplate(content)) {
    if (seg.kind === 'var' && seg.builtin && isBuiltin(seg.name) && !names.includes(seg.name)) {
      names.push(seg.name);
    }
  }
  return names;
}

/**
 * Brings variable configs in line with the content: keeps settings for names
 * still present, adds new names as single-line text, drops removed ones.
 */
export function syncVariables(content: string, existing: Variable[]): Variable[] {
  return extractVariableNames(content).map(
    (name) =>
      existing.find((v) => v.name === name) ?? { name, type: 'text', default: '', options: [] },
  );
}

export interface BuiltinContext {
  clipboard?: string;
  selection?: string;
  now?: Date;
}

export function formatDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function builtinValues(ctx: BuiltinContext): Record<BuiltinName, string> {
  const now = ctx.now ?? new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    剪贴板: ctx.clipboard ?? '',
    选中文本: ctx.selection ?? '',
    今天: formatDate(now),
    现在: `${formatDate(now)} ${pad(now.getHours())}:${pad(now.getMinutes())}`,
  };
}

/**
 * Initial form values: last-used value if remembered, else the default
 * (first option for selects).
 */
export function initialValues(
  variables: Variable[],
  lastValues: Record<string, string> = {},
): Record<string, string> {
  const values: Record<string, string> = {};
  for (const v of variables) {
    const remembered = lastValues[v.name];
    if (remembered !== undefined && remembered !== '') values[v.name] = remembered;
    else if (v.type === 'select') values[v.name] = v.default || v.options[0] || '';
    else values[v.name] = v.default;
  }
  return values;
}

/**
 * Fills in a template. Unknown built-ins and variables without a value are
 * left as their original token so nothing is silently lost.
 */
export function renderTemplate(
  content: string,
  values: Record<string, string>,
  builtins: Partial<Record<string, string>> = {},
): string {
  return parseTemplate(content)
    .map((seg) => {
      if (seg.kind === 'text') return seg.text;
      const value = seg.builtin ? builtins[seg.name] : values[seg.name];
      return value === undefined || value === '' ? seg.raw : value;
    })
    .join('');
}

/** Rough token estimate: CJK chars ≈ 1 token each, other text ≈ 4 chars per token. */
export function estimateTokens(text: string): number {
  const cjk = (text.match(/[　-鿿＀-￯]/g) ?? []).length;
  const rest = text.length - cjk;
  return Math.ceil(cjk + rest / 4);
}

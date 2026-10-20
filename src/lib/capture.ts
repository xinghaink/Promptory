/**
 * Rule-based helpers for saving a prompt found on a web page: guess a title,
 * suggest tags, and spot quoted phrases that are likely meant to be swapped.
 */

export interface VariableCandidate {
  /** The literal text found in the prompt, without its quotes. */
  text: string;
  /** Suggested variable name; the user can rename it before saving. */
  name: string;
}

const ROLE_PREFIX = /^(你是|你现在是|假设你是|请你扮演|扮演)[^。，,.!！?？\n]*[。，,.!！?？\n]\s*/;

export function suggestTitle(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return '未命名提示词';
  let body = trimmed.replace(ROLE_PREFIX, '');
  if (!body) body = trimmed;
  body = body.replace(/^(请|帮我|麻烦|请你|你需要)\s*/, '');
  const first = body.split(/[。，,.!！?？\n:：；;]/)[0].trim();
  const title = (first || trimmed.split('\n')[0]).trim();
  return title.length > 16 ? `${title.slice(0, 16)}…` : title;
}

const TAG_RULES: Array<[RegExp, string[]]> = [
  [/小红书/, ['小红书', '营销']],
  [/文案|广告|营销|卖点|标题/, ['营销']],
  [/代码|code|bug|函数|编程|重构|review/i, ['代码']],
  [/sql|数据|表格|excel|分析/i, ['数据分析']],
  [/翻译|英文|中文|英语|translate/i, ['翻译']],
  [/周报|日报|月报|总结|汇报|会议/, ['职场']],
  [/邮件|email/i, ['写作']],
  [/文章|写作|润色|改写|大纲/, ['写作']],
  [/json|表格形式|markdown|格式输出/i, ['结构化输出']],
  [/你是|扮演/, ['角色扮演']],
];

export function suggestTags(text: string): string[] {
  const tags: string[] = [];
  for (const [re, add] of TAG_RULES) {
    if (re.test(text)) for (const t of add) if (!tags.includes(t)) tags.push(t);
  }
  return tags.slice(0, 4);
}

const QUOTED = /「([^」\n]{1,30})」|“([^”\n]{1,30})”|"([^"\n]{1,30})"|《([^》\n]{1,30})》|【([^】\n]{1,30})】|\[([^\]\n]{1,30})\]|<([^<>\n]{1,30})>/g;

/**
 * Quoted phrases are the most common placeholders in shared prompts
 * (「产品名」, [主题], <topic>…). Each becomes a candidate variable.
 */
export function findVariableCandidates(text: string): VariableCandidate[] {
  const seen = new Set<string>();
  const out: VariableCandidate[] = [];
  for (const m of text.matchAll(QUOTED)) {
    const inner = (m.slice(1).find((g) => g !== undefined) ?? '').trim();
    if (!inner || seen.has(inner) || inner.includes('{{')) continue;
    seen.add(inner);
    const name = inner.length <= 6 ? inner : `变量${out.length + 1}`;
    out.push({ text: inner, name });
  }
  return out.slice(0, 8);
}

/** Replaces each chosen candidate (with its quotes) by a `{{name}}` token. */
export function applyCandidates(text: string, chosen: VariableCandidate[]): string {
  let out = text;
  for (const c of chosen) {
    const name = c.name.trim() || c.text;
    const escaped = c.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const quoted = new RegExp(`「${escaped}」|“${escaped}”|"${escaped}"|《${escaped}》|【${escaped}】|\\[${escaped}\\]|<${escaped}>`, 'g');
    out = out.replace(quoted, `{{${name}}}`);
  }
  return out;
}

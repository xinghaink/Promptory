import type { Prompt } from './types';

export interface Searchable {
  prompt: Prompt;
  content: string;
  folderName?: string;
}

export interface SearchHit<T extends Searchable> {
  item: T;
  score: number;
  /** Where the query matched, for showing context in results. */
  matchedIn: 'shortcut' | 'title' | 'tag' | 'description' | 'folder' | 'content' | 'none';
  snippet: string;
}

/** True when every char of `needle` appears in `hay` in order, e.g. "cdrv" ~ "code review". */
function isSubsequence(needle: string, hay: string): boolean {
  let i = 0;
  for (const ch of hay) {
    if (ch === needle[i]) i++;
    if (i === needle.length) return true;
  }
  return needle.length === 0;
}

function snippetAround(text: string, idx: number, len: number): string {
  const start = Math.max(0, idx - 12);
  const end = Math.min(text.length, idx + len + 18);
  return (start > 0 ? '…' : '') + text.slice(start, end).replace(/\s+/g, ' ') + (end < text.length ? '…' : '');
}

/** Small frequency/recency boost so prompts you actually use float up. */
function usageBoost(p: Prompt, now: number): number {
  const freq = Math.log2(1 + p.useCount) * 2;
  const recency = p.lastUsedAt ? Math.max(0, 5 - (now - p.lastUsedAt) / 86_400_000) : 0;
  return freq + recency + (p.isFavorite ? 2 : 0);
}

function scoreTerm<T extends Searchable>(item: T, term: string): Omit<SearchHit<T>, 'item'> | null {
  const { prompt } = item;
  const title = prompt.title.toLowerCase();
  const shortcut = prompt.shortcut.toLowerCase();
  if (shortcut && shortcut === term) return { score: 100, matchedIn: 'shortcut', snippet: '' };
  if (shortcut && shortcut.startsWith(term)) return { score: 70, matchedIn: 'shortcut', snippet: '' };
  if (title === term) return { score: 90, matchedIn: 'title', snippet: '' };
  if (title.startsWith(term)) return { score: 60, matchedIn: 'title', snippet: '' };
  if (title.includes(term)) return { score: 50, matchedIn: 'title', snippet: '' };
  if (prompt.tags.some((t) => t.toLowerCase().includes(term))) return { score: 35, matchedIn: 'tag', snippet: '' };
  const desc = prompt.description.toLowerCase();
  const di = desc.indexOf(term);
  if (di >= 0) return { score: 25, matchedIn: 'description', snippet: snippetAround(prompt.description, di, term.length) };
  if (item.folderName?.toLowerCase().includes(term)) return { score: 20, matchedIn: 'folder', snippet: '' };
  const content = item.content.toLowerCase();
  const ci = content.indexOf(term);
  if (ci >= 0) return { score: 15, matchedIn: 'content', snippet: snippetAround(item.content, ci, term.length) };
  if (/^[a-z0-9]+$/.test(term) && term.length >= 2 && isSubsequence(term, title)) {
    return { score: 10, matchedIn: 'title', snippet: '' };
  }
  return null;
}

/**
 * Space-separated terms must all match (AND). An empty query returns
 * everything ordered by usage.
 */
export function searchPrompts<T extends Searchable>(items: T[], query: string, now = Date.now()): SearchHit<T>[] {
  const terms = query.trim().toLowerCase().replace(/^\//, '').split(/\s+/).filter(Boolean);
  const hits: SearchHit<T>[] = [];
  for (const item of items) {
    if (terms.length === 0) {
      hits.push({ item, score: usageBoost(item.prompt, now), matchedIn: 'none', snippet: '' });
      continue;
    }
    let total = 0;
    let best: Omit<SearchHit<T>, 'item'> | null = null;
    let ok = true;
    for (const term of terms) {
      const r = scoreTerm(item, term);
      if (!r) {
        ok = false;
        break;
      }
      total += r.score;
      if (!best || r.score > best.score) best = r;
    }
    if (ok && best) hits.push({ item, score: total + usageBoost(item.prompt, now), matchedIn: best.matchedIn, snippet: best.snippet });
  }
  return hits.sort((a, b) => b.score - a.score || b.item.prompt.updatedAt - a.item.prompt.updatedAt);
}

import type { PromptoryDB } from './db';
import type { Repo } from './repo';
import type { Folder, Prompt, Variable, Version } from './types';

/** One prompt to import. `versions` (oldest first) is only set for Promptory backups. */
export interface ImportItem {
  title: string;
  content: string;
  description?: string;
  tags?: string[];
  folderName?: string;
  shortcut?: string;
  models?: string[];
  isFavorite?: boolean;
  versions?: Array<{ content: string; note: string; variables?: Variable[] }>;
  /** Version number (1-based, in `versions` order) to mark as recommended. */
  recommended?: number;
}

export interface Backup {
  format: 'promptory';
  schema: 1;
  exportedAt: string;
  folders: Folder[];
  prompts: Array<Prompt & { versions: Version[] }>;
}

export async function exportBackup(db: PromptoryDB): Promise<Backup> {
  const [folders, prompts, versions] = await Promise.all([
    db.folders.orderBy('order').toArray(),
    db.prompts.toArray(),
    db.versions.toArray(),
  ]);
  return {
    format: 'promptory',
    schema: 1,
    exportedAt: new Date().toISOString(),
    folders,
    prompts: prompts
      .filter((p) => p.deletedAt === null)
      .map((p) => ({
        ...p,
        versions: versions.filter((v) => v.promptId === p.id).sort((a, b) => a.number - b.number),
      })),
  };
}

/** Markdown export of the recommended version of each prompt. */
export async function exportMarkdown(db: PromptoryDB): Promise<string> {
  const backup = await exportBackup(db);
  const folderName = new Map(backup.folders.map((f) => [f.id, f.name]));
  const parts = backup.prompts.map((p) => {
    const v = p.versions.find((x) => x.number === p.recommendedVersion) ?? p.versions.at(-1);
    const meta = [
      p.folderId ? `文件夹：${folderName.get(p.folderId) ?? ''}` : '',
      p.tags.length ? `标签：${p.tags.map((t) => `#${t}`).join(' ')}` : '',
      p.shortcut ? `快捷词：/${p.shortcut}` : '',
    ].filter(Boolean);
    return [
      `## ${p.title}`,
      p.description ? `\n> ${p.description}` : '',
      meta.length ? `\n${meta.join(' · ')}` : '',
      '\n````text',
      v?.content ?? '',
      '````',
    ].join('\n');
  });
  return `# Promptory 导出\n\n${parts.join('\n\n')}\n`;
}

/** Converts Raycast placeholders to Promptory syntax. */
export function convertRaycast(prompt: string): string {
  return prompt
    .replace(/\{selection(\s*\|[^}]*)?\}/g, '{{@选中文本}}')
    .replace(/\{clipboard(\s*\|[^}]*)?\}/g, '{{@剪贴板}}')
    .replace(/\{date(\s+[^}]*)?\}/g, '{{@今天}}')
    .replace(/\{argument\s+name="([^"]+)"[^}]*\}/g, '{{$1}}')
    .replace(/\{argument[^}]*\}/g, '{{参数}}');
}

/** Minimal RFC 4180 CSV parser (quoted fields, escaped quotes, newlines in quotes). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const src = text.replace(/^﻿/, '');
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += ch;
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

const COLS = {
  title: ['title', 'name', '标题', '名称', 'act'],
  content: ['prompt', 'content', 'template', '内容', '提示词', 'text'],
  description: ['description', 'teaser', 'desc', '描述', '说明'],
  tags: ['tags', 'tag', '标签', 'topic', 'activity'],
  folder: ['folder', 'category', '分类', '文件夹', 'community'],
};

function splitTags(s: string | undefined): string[] {
  return (s ?? '').split(/[,，;；|#\s]+/).map((t) => t.trim()).filter(Boolean);
}

function fromCsv(text: string): ImportItem[] {
  const [header, ...rows] = parseCsv(text);
  if (!header) return [];
  const lower = header.map((h) => h.trim().toLowerCase());
  const col = (names: string[]) => lower.findIndex((h) => names.includes(h));
  const idx = {
    title: col(COLS.title),
    content: col(COLS.content),
    description: col(COLS.description),
    tags: col(COLS.tags),
    folder: col(COLS.folder),
  };
  if (idx.content < 0) throw new Error('CSV 中没有找到提示词内容列（prompt / content / 内容）');
  return rows
    .map((r) => {
      const content = r[idx.content]?.trim() ?? '';
      return {
        title: (idx.title >= 0 ? r[idx.title]?.trim() : '') || content.slice(0, 16),
        content,
        description: idx.description >= 0 ? r[idx.description]?.trim() : undefined,
        tags: idx.tags >= 0 ? splitTags(r[idx.tags]) : [],
        folderName: idx.folder >= 0 ? r[idx.folder]?.trim() || undefined : undefined,
      };
    })
    .filter((i) => i.content);
}

/** Markdown: each `## 标题` section is one prompt; a fenced block, if any, is the content. */
function fromMarkdown(text: string): ImportItem[] {
  const sections = text.split(/^##\s+/m).slice(1);
  return sections
    .map((sec) => {
      const [titleLine, ...rest] = sec.split('\n');
      const body = rest.join('\n');
      const fence = body.match(/^(`{3,}|~{3,})[^\n]*\n([\s\S]*?)\n\1\s*$/m);
      const quote = body.match(/^>\s?(.*)$/m);
      const tagLine = body.match(/标签：([^\n·]*)/);
      const folderLine = body.match(/文件夹：([^\n·]*)/);
      const shortcutLine = body.match(/快捷词：\/(\S+)/);
      const content = fence ? fence[2] : body.replace(/^>.*$/gm, '').trim();
      return {
        title: titleLine.trim(),
        content,
        description: fence ? quote?.[1].trim() : undefined,
        tags: fence ? splitTags(tagLine?.[1]) : [],
        folderName: fence ? folderLine?.[1].trim() || undefined : undefined,
        shortcut: fence ? shortcutLine?.[1] : undefined,
      };
    })
    .filter((i) => i.title && i.content.trim());
}

function fromJson(text: string): ImportItem[] {
  const data: unknown = JSON.parse(text);
  if (data && typeof data === 'object' && (data as Backup).format === 'promptory') {
    const backup = data as Backup;
    const folderName = new Map(backup.folders.map((f) => [f.id, f.name]));
    return backup.prompts.map((p) => {
      const sorted = [...p.versions].sort((a, b) => a.number - b.number);
      return {
        title: p.title,
        content: sorted.at(-1)?.content ?? '',
        description: p.description,
        tags: p.tags,
        folderName: p.folderId ? folderName.get(p.folderId) : undefined,
        shortcut: p.shortcut,
        models: p.models,
        isFavorite: p.isFavorite,
        versions: sorted.map((v) => ({ content: v.content, note: v.note, variables: v.variables })),
        recommended: Math.max(1, sorted.findIndex((v) => v.number === p.recommendedVersion) + 1),
      };
    });
  }
  const list = Array.isArray(data) ? data : (data as { prompts?: unknown[] })?.prompts;
  if (!Array.isArray(list)) throw new Error('无法识别的 JSON 格式');
  return list
    .map((raw): ImportItem | null => {
      if (!raw || typeof raw !== 'object') return null;
      const o = raw as Record<string, unknown>;
      const str = (k: string) => (typeof o[k] === 'string' ? (o[k] as string) : undefined);
      const rawContent = str('prompt') ?? str('content') ?? str('template') ?? str('text');
      if (!rawContent) return null;
      // Raycast AI Commands export: { title, prompt, creativity, model, icon }
      const isRaycast = 'creativity' in o || /\{(selection|clipboard|argument)/.test(rawContent);
      const content = isRaycast ? convertRaycast(rawContent) : rawContent;
      return {
        title: str('title') ?? str('name') ?? content.slice(0, 16),
        content,
        description: str('description'),
        tags: Array.isArray(o.tags) ? (o.tags as unknown[]).map(String) : splitTags(str('tags')),
        folderName: str('folder') ?? str('category'),
      };
    })
    .filter((i): i is ImportItem => i !== null);
}

export function parseImport(text: string, filename: string): ImportItem[] {
  const ext = filename.toLowerCase().split('.').pop();
  if (ext === 'json') return fromJson(text);
  if (ext === 'csv') return fromCsv(text);
  if (ext === 'md' || ext === 'markdown' || ext === 'txt') return fromMarkdown(text);
  const trimmed = text.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return fromJson(text);
  if (trimmed.startsWith('#')) return fromMarkdown(text);
  return fromCsv(text);
}

/** Imports items as new prompts (never overwrites). Returns the number imported. */
export async function importItems(repo: Repo, items: ImportItem[]): Promise<number> {
  let count = 0;
  for (const item of items) {
    const folder = item.folderName ? await repo.ensureFolder(item.folderName) : null;
    const shortcut = item.shortcut && !(await repo.findByShortcut(item.shortcut)) ? item.shortcut : '';
    const history = item.versions?.length ? item.versions : [{ content: item.content, note: '导入', variables: [] }];
    const prompt = await repo.createPrompt({
      title: item.title,
      content: history[0].content,
      variables: history[0].variables,
      note: history[0].note,
      description: item.description,
      tags: item.tags,
      folderId: folder?.id ?? null,
      shortcut,
      models: item.models,
      isFavorite: item.isFavorite,
    });
    for (const v of history.slice(1)) {
      await repo.saveVersion(prompt.id, { content: v.content, variables: v.variables ?? [], note: v.note });
    }
    if (item.recommended && item.recommended < history.length) await repo.setRecommended(prompt.id, item.recommended);
    count++;
  }
  return count;
}

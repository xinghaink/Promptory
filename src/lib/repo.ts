import { db as defaultDb, type PromptoryDB } from './db';
import type { Draft, Folder, Prompt, PromptWithVersion, Variable, Version } from './types';
import { syncVariables } from './variables';

export const TRASH_DAYS = 30;

const uid = () => crypto.randomUUID();

export interface NewPromptInput {
  title: string;
  content: string;
  description?: string;
  folderId?: string | null;
  tags?: string[];
  models?: string[];
  shortcut?: string;
  inInbox?: boolean;
  isFavorite?: boolean;
  sourceUrl?: string;
  variables?: Variable[];
  note?: string;
}

export function normalizeShortcut(s: string): string {
  return s.trim().replace(/^\/+/, '').replace(/\s+/g, '').toLowerCase();
}

function normalizeTags(tags: string[]): string[] {
  const out: string[] = [];
  for (const t of tags) {
    const clean = t.trim().replace(/^#/, '');
    if (clean && !out.includes(clean)) out.push(clean);
  }
  return out;
}

export function createRepo(db: PromptoryDB = defaultDb) {
  async function getVersion(promptId: string, number: number): Promise<Version | undefined> {
    return db.versions.where('[promptId+number]').equals([promptId, number]).first();
  }

  async function requirePrompt(id: string): Promise<Prompt> {
    const p = await db.prompts.get(id);
    if (!p) throw new Error(`提示词不存在：${id}`);
    return p;
  }

  async function createPrompt(input: NewPromptInput): Promise<Prompt> {
    const now = Date.now();
    const id = uid();
    const prompt: Prompt = {
      id,
      title: input.title.trim() || '未命名提示词',
      description: input.description?.trim() ?? '',
      folderId: input.folderId ?? null,
      tags: normalizeTags(input.tags ?? []),
      models: input.models ?? [],
      shortcut: normalizeShortcut(input.shortcut ?? ''),
      isFavorite: input.isFavorite ?? false,
      inInbox: input.inInbox ?? false,
      sourceUrl: input.sourceUrl ?? '',
      draft: null,
      recommendedVersion: 1,
      latestVersion: 1,
      lastValues: {},
      useCount: 0,
      lastUsedAt: null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    const version: Version = {
      id: uid(),
      promptId: id,
      number: 1,
      content: input.content,
      variables: syncVariables(input.content, input.variables ?? []),
      note: input.note ?? '初始版本',
      useCount: 0,
      goodCount: 0,
      badCount: 0,
      createdAt: now,
    };
    await db.transaction('rw', db.prompts, db.versions, async () => {
      await db.prompts.add(prompt);
      await db.versions.add(version);
    });
    return prompt;
  }

  type MetaPatch = Partial<
    Pick<Prompt, 'title' | 'description' | 'folderId' | 'tags' | 'models' | 'shortcut' | 'isFavorite' | 'inInbox'>
  >;

  async function updateMeta(id: string, patch: MetaPatch): Promise<void> {
    const clean: MetaPatch = { ...patch };
    if (clean.tags) clean.tags = normalizeTags(clean.tags);
    if (clean.shortcut !== undefined) clean.shortcut = normalizeShortcut(clean.shortcut);
    if (clean.title !== undefined) clean.title = clean.title.trim() || '未命名提示词';
    await db.prompts.update(id, { ...clean, updatedAt: Date.now() });
  }

  async function saveDraft(id: string, draft: Draft | null): Promise<void> {
    await db.prompts.update(id, { draft });
  }

  /**
   * Saves content as a new version and clears the draft. The recommended
   * version follows the latest one unless the user pinned an older version.
   */
  async function saveVersion(
    id: string,
    input: { content: string; variables: Variable[]; note?: string },
  ): Promise<Version> {
    return db.transaction('rw', db.prompts, db.versions, async () => {
      const p = await requirePrompt(id);
      const number = p.latestVersion + 1;
      const version: Version = {
        id: uid(),
        promptId: id,
        number,
        content: input.content,
        variables: syncVariables(input.content, input.variables),
        note: input.note?.trim() ?? '',
        useCount: 0,
        goodCount: 0,
        badCount: 0,
        createdAt: Date.now(),
      };
      await db.versions.add(version);
      const followsLatest = p.recommendedVersion === p.latestVersion;
      await db.prompts.update(id, {
        latestVersion: number,
        recommendedVersion: followsLatest ? number : p.recommendedVersion,
        draft: null,
        updatedAt: Date.now(),
      });
      return version;
    });
  }

  async function setRecommended(id: string, number: number): Promise<void> {
    if (!(await getVersion(id, number))) throw new Error(`版本不存在：v${number}`);
    await db.prompts.update(id, { recommendedVersion: number, updatedAt: Date.now() });
  }

  /** Restoring never rewrites history: the old content becomes a new version. */
  async function restoreVersion(id: string, number: number): Promise<Version> {
    const old = await getVersion(id, number);
    if (!old) throw new Error(`版本不存在：v${number}`);
    return saveVersion(id, { content: old.content, variables: old.variables, note: `恢复自 v${number}` });
  }

  async function listVersions(id: string): Promise<Version[]> {
    const versions = await db.versions.where('promptId').equals(id).toArray();
    return versions.sort((a, b) => b.number - a.number);
  }

  async function getWithVersion(id: string, number?: number): Promise<PromptWithVersion | null> {
    const prompt = await db.prompts.get(id);
    if (!prompt) return null;
    const version = await getVersion(id, number ?? prompt.recommendedVersion);
    return version ? { prompt, version } : null;
  }

  /** Every non-deleted prompt with its recommended version. */
  async function listActiveWithVersions(): Promise<PromptWithVersion[]> {
    const prompts = (await db.prompts.toArray()).filter((p) => p.deletedAt === null);
    const versions = await db.versions.toArray();
    const byKey = new Map(versions.map((v) => [`${v.promptId}#${v.number}`, v]));
    return prompts.flatMap((prompt) => {
      const version = byKey.get(`${prompt.id}#${prompt.recommendedVersion}`);
      return version ? [{ prompt, version }] : [];
    });
  }

  async function recordUse(
    id: string,
    versionNumber: number,
    values: Record<string, string>,
    remember: boolean,
  ): Promise<void> {
    await db.transaction('rw', db.prompts, db.versions, async () => {
      const p = await requirePrompt(id);
      await db.prompts.update(id, {
        useCount: p.useCount + 1,
        lastUsedAt: Date.now(),
        lastValues: remember ? values : p.lastValues,
      });
      const v = await getVersion(id, versionNumber);
      if (v) await db.versions.update(v.id, { useCount: v.useCount + 1 });
    });
  }

  async function giveFeedback(id: string, versionNumber: number, good: boolean): Promise<void> {
    const v = await getVersion(id, versionNumber);
    if (!v) return;
    await db.versions.update(v.id, good ? { goodCount: v.goodCount + 1 } : { badCount: v.badCount + 1 });
  }

  async function moveToTrash(id: string): Promise<void> {
    await db.prompts.update(id, { deletedAt: Date.now() });
  }

  async function restoreFromTrash(id: string): Promise<void> {
    await db.prompts.update(id, { deletedAt: null, updatedAt: Date.now() });
  }

  async function purge(id: string): Promise<void> {
    await db.transaction('rw', db.prompts, db.versions, async () => {
      await db.versions.where('promptId').equals(id).delete();
      await db.prompts.delete(id);
    });
  }

  async function purgeExpired(now = Date.now()): Promise<number> {
    const cutoff = now - TRASH_DAYS * 86_400_000;
    const expired = (await db.prompts.toArray()).filter((p) => p.deletedAt !== null && p.deletedAt < cutoff);
    for (const p of expired) await purge(p.id);
    return expired.length;
  }

  async function findByShortcut(shortcut: string, exceptId?: string): Promise<Prompt | undefined> {
    const s = normalizeShortcut(shortcut);
    if (!s) return undefined;
    const matches = await db.prompts.where('shortcut').equals(s).toArray();
    return matches.find((p) => p.id !== exceptId && p.deletedAt === null);
  }

  async function listFolders(): Promise<Folder[]> {
    return db.folders.orderBy('order').toArray();
  }

  async function createFolder(name: string): Promise<Folder> {
    const folders = await listFolders();
    const folder: Folder = { id: uid(), name: name.trim() || '新文件夹', order: (folders.at(-1)?.order ?? 0) + 1 };
    await db.folders.add(folder);
    return folder;
  }

  async function ensureFolder(name: string): Promise<Folder> {
    const existing = (await listFolders()).find((f) => f.name === name.trim());
    return existing ?? createFolder(name);
  }

  async function renameFolder(id: string, name: string): Promise<void> {
    await db.folders.update(id, { name: name.trim() || '新文件夹' });
  }

  /** Deleting a folder keeps its prompts; they just become unfiled. */
  async function deleteFolder(id: string): Promise<void> {
    await db.transaction('rw', db.prompts, db.folders, async () => {
      await db.prompts.where('folderId').equals(id).modify({ folderId: null });
      await db.folders.delete(id);
    });
  }

  return {
    createPrompt,
    updateMeta,
    saveDraft,
    saveVersion,
    setRecommended,
    restoreVersion,
    listVersions,
    getVersion,
    getWithVersion,
    listActiveWithVersions,
    recordUse,
    giveFeedback,
    moveToTrash,
    restoreFromTrash,
    purge,
    purgeExpired,
    findByShortcut,
    listFolders,
    createFolder,
    ensureFolder,
    renameFolder,
    deleteFolder,
  };
}

export type Repo = ReturnType<typeof createRepo>;

export const repo = createRepo();

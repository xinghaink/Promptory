import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import type { Folder, Prompt, Version } from '@/lib/types';

export interface LibraryData {
  prompts: Prompt[];
  folders: Folder[];
  /** Version used by default for each prompt, by prompt id. */
  recommended: Map<string, Version>;
  folderName: Map<string, string>;
}

/** Whole library, live. A personal library is small enough to keep in memory. */
export function useLibrary(): LibraryData | undefined {
  return useLiveQuery(async () => {
    const [prompts, versions, folders] = await Promise.all([
      db.prompts.toArray(),
      db.versions.toArray(),
      db.folders.orderBy('order').toArray(),
    ]);
    const byKey = new Map(versions.map((v) => [`${v.promptId}#${v.number}`, v]));
    const recommended = new Map<string, Version>();
    for (const p of prompts) {
      const v = byKey.get(`${p.id}#${p.recommendedVersion}`);
      if (v) recommended.set(p.id, v);
    }
    return { prompts, folders, recommended, folderName: new Map(folders.map((f) => [f.id, f.name])) };
  });
}

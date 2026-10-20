import Dexie, { type EntityTable } from 'dexie';
import type { Folder, Prompt, Version } from './types';

export class PromptoryDB extends Dexie {
  prompts!: EntityTable<Prompt, 'id'>;
  versions!: EntityTable<Version, 'id'>;
  folders!: EntityTable<Folder, 'id'>;

  constructor(name = 'promptory') {
    super(name);
    this.version(1).stores({
      prompts: 'id, folderId, updatedAt, deletedAt, *tags, shortcut',
      versions: 'id, promptId, [promptId+number]',
      folders: 'id, order',
    });
  }
}

export const db = new PromptoryDB();

import { browser } from 'wxt/browser';
import type { Folder, PromptWithVersion } from './types';

/** Messages a content script sends to the background, which owns the database. */
export type Request =
  | { type: 'list' }
  | { type: 'recordUse'; id: string; version: number; values: Record<string, string>; remember: boolean }
  | { type: 'feedback'; id: string; version: number; good: boolean }
  | { type: 'openApp'; hash?: string };

export interface ListResponse {
  items: PromptWithVersion[];
  folders: Folder[];
}

/** Messages the background sends to a tab's content script. */
export type TabMessage = { type: 'open-palette' };

export async function send(req: { type: 'list' }): Promise<ListResponse>;
export async function send(req: Exclude<Request, { type: 'list' }>): Promise<void>;
export async function send(req: Request): Promise<unknown> {
  return browser.runtime.sendMessage(req);
}

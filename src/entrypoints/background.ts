import { browser } from 'wxt/browser';
import { defineBackground } from 'wxt/utils/define-background';
import { db } from '@/lib/db';
import type { Request, TabMessage } from '@/lib/messaging';
import { repo } from '@/lib/repo';
import { seedSamples } from '@/lib/samples';

const MENU_SAVE = 'promptory-save-selection';

export interface PendingCapture {
  text: string;
  url: string;
}

async function openApp(hash = ''): Promise<void> {
  const base = browser.runtime.getURL('/app.html');
  const url = hash ? `${base}#${hash}` : base;
  // Reuse an open Promptory tab; querying by URL may be refused without the "tabs" permission.
  const [existing] = await browser.tabs.query({ url: `${base}*` }).catch(() => []);
  if (existing?.id !== undefined) {
    await browser.tabs.update(existing.id, { active: true, ...(hash ? { url } : {}) });
    if (existing.windowId !== undefined) await browser.windows.update(existing.windowId, { focused: true });
  } else {
    await browser.tabs.create({ url });
  }
}

/** The capture page reads the pending text from session storage, so long text never goes in a URL. */
async function openCapture(capture: PendingCapture): Promise<void> {
  await browser.storage.session.set({ pendingCapture: capture });
  await browser.windows.create({
    url: browser.runtime.getURL('/capture.html'),
    type: 'popup',
    width: 480,
    height: 680,
  });
}

async function selectionInTab(tabId: number): Promise<string> {
  const [result] = await browser.scripting.executeScript({
    target: { tabId },
    func: () => window.getSelection()?.toString() ?? '',
  });
  return typeof result?.result === 'string' ? result.result : '';
}

async function handle(req: Request): Promise<unknown> {
  switch (req.type) {
    case 'list':
      return { items: await repo.listActiveWithVersions(), folders: await repo.listFolders() };
    case 'recordUse':
      return repo.recordUse(req.id, req.version, req.values, req.remember);
    case 'feedback':
      return repo.giveFeedback(req.id, req.version, req.good);
    case 'openApp':
      return openApp(req.hash);
  }
}

export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(async ({ reason }) => {
    await browser.contextMenus.removeAll();
    browser.contextMenus.create({ id: MENU_SAVE, title: '保存到 Promptory', contexts: ['selection'] });
    if (reason === 'install') {
      if ((await db.prompts.count()) === 0) await seedSamples(repo);
      await openApp('/welcome');
    }
  });

  browser.runtime.onStartup.addListener(() => {
    void repo.purgeExpired();
  });

  browser.action.onClicked.addListener(() => {
    void openApp();
  });

  browser.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId !== MENU_SAVE || !info.selectionText) return;
    void openCapture({ text: info.selectionText, url: tab?.url ?? info.pageUrl ?? '' });
  });

  browser.commands.onCommand.addListener(async (command, tab) => {
    const active = tab ?? (await browser.tabs.query({ active: true, currentWindow: true }))[0];
    if (active?.id === undefined) return;
    if (command === 'open-palette') {
      const msg: TabMessage = { type: 'open-palette' };
      await browser.tabs.sendMessage(active.id, msg).catch(() => undefined);
    } else if (command === 'save-selection') {
      const text = await selectionInTab(active.id).catch(() => '');
      await openCapture({ text, url: active.url ?? '' });
    }
  });

  // Chrome only keeps the channel open for async replies via sendResponse + `return true`.
  browser.runtime.onMessage.addListener((req: Request, _sender, sendResponse) => {
    handle(req).then(
      (result) => sendResponse(result),
      (err: unknown) => sendResponse({ error: String(err) }),
    );
    return true;
  });
});

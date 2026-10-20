import { useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from 'react';
import { browser } from 'wxt/browser';
import { VariableForm } from '@/components/VariableForm';
import { copyText, readClipboard } from '@/lib/clipboard';
import { send, type ListResponse, type TabMessage } from '@/lib/messaging';
import { searchPrompts } from '@/lib/search';
import type { PromptWithVersion } from '@/lib/types';
import {
  builtinValues,
  extractBuiltinNames,
  initialValues,
  renderTemplate,
  type BuiltinName,
} from '@/lib/variables';
import {
  editableFrom,
  findComposer,
  getText,
  insertIntoComposer,
  saveCaret,
  submitComposer,
  type SavedCaret,
} from './composer';

/** `/` alone or `/keyword` as the whole composer content opens the palette. */
const SLASH = /^\/([^\s/]{0,24})$/;

type Mode = 'slash' | 'hotkey';

interface Session {
  mode: Mode;
  composer: HTMLElement | null;
  caret?: SavedCaret;
}

interface Notice {
  id: string;
  version: number;
  title: string;
  copied: boolean;
}

export function PaletteHost({ host }: { host: HTMLElement }) {
  const [session, setSession] = useState<Session | null>(null);
  const [query, setQuery] = useState('');
  const [data, setData] = useState<ListResponse | null>(null);
  const [active, setActive] = useState(0);
  const [values, setValues] = useState<Record<string, Record<string, string>>>({});
  const [builtins, setBuiltins] = useState<Record<string, string>>({});
  const [formFocus, setFormFocus] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [, relayout] = useReducer((n: number) => n + 1, 0);
  const formRef = useRef<HTMLDivElement>(null);
  const clipboardTried = useRef(false);

  const hits = useMemo(() => {
    if (!data) return [];
    const folderName = new Map(data.folders.map((f) => [f.id, f.name]));
    const items = data.items.map((it) => ({
      ...it,
      prompt: it.prompt,
      content: it.version.content,
      folderName: it.prompt.folderId ? folderName.get(it.prompt.folderId) : undefined,
    }));
    return searchPrompts(items, query).slice(0, 8);
  }, [data, query]);

  const current: (PromptWithVersion & { folderName?: string }) | undefined = hits[Math.min(active, hits.length - 1)]?.item;
  const currentValues = current
    ? (values[current.prompt.id] ?? initialValues(current.version.variables, current.prompt.lastValues))
    : {};
  const currentBuiltins = current ? extractBuiltinNames(current.version.content) : [];

  function open(mode: Mode, composer: HTMLElement | null, q: string) {
    if (!session) {
      const sel = window.getSelection();
      const selection = sel && !(composer && sel.anchorNode && composer.contains(sel.anchorNode)) ? sel.toString() : '';
      setSession({ mode, composer, caret: composer ? saveCaret(composer) : undefined });
      setBuiltins(builtinValues({ selection }));
      setValues({});
      setActive(0);
      setFormFocus(false);
      clipboardTried.current = false;
      void send({ type: 'list' })
        .then((res) => setData(res?.items ? res : { items: [], folders: [] }))
        .catch(() => setData({ items: [], folders: [] }));
    }
    setQuery(q);
    setActive(0);
  }

  function close(refocus: boolean) {
    const s = session;
    setSession(null);
    setFormFocus(false);
    if (refocus && s?.composer) s.composer.focus();
  }

  function insert(andSend: boolean) {
    if (!current || !session) return;
    const text = renderTemplate(current.version.content, currentValues, builtins);
    const { composer, mode, caret } = session;
    close(false);
    if (composer) {
      insertIntoComposer(composer, text, mode === 'slash', caret);
      if (andSend) window.setTimeout(() => submitComposer(composer), 200);
    } else {
      void copyText(text);
    }
    void send({ type: 'recordUse', id: current.prompt.id, version: current.version.number, values: currentValues, remember: true });
    setNotice({ id: current.prompt.id, version: current.version.number, title: current.prompt.title, copied: !composer });
  }

  /** Enter on the list: insert right away unless a variable still needs a value. */
  function pick(andSend: boolean) {
    if (!current) return;
    const missing = current.version.variables.some((v) => !currentValues[v.name]?.trim());
    if (missing && !formFocus) setFormFocus(true);
    else insert(andSend);
  }

  function move(delta: number) {
    setActive((a) => Math.max(0, Math.min(hits.length - 1, a + delta)));
    setFormFocus(false);
  }

  /** Shared key handling for the composer (slash mode) and the palette's search box. */
  function onListKey(e: KeyboardEvent | React.KeyboardEvent): boolean {
    if (e.key === 'ArrowDown') move(1);
    else if (e.key === 'ArrowUp') move(-1);
    else if (e.key === 'Enter') pick(e.metaKey || e.ctrlKey);
    else if (e.key === 'Tab' && current && (current.version.variables.length || currentBuiltins.length)) setFormFocus(true);
    else if (e.key === 'Escape') close(true);
    else return false;
    e.preventDefault();
    e.stopPropagation();
    return true;
  }

  // Listeners read the latest render through this ref.
  const latest = useRef({ session, open, close, onListKey });
  latest.current = { session, open, close, onListKey };

  useEffect(() => {
    const inPalette = (e: Event) => e.composedPath().includes(host);

    const onInput = (e: Event) => {
      if (inPalette(e)) return;
      const composer = editableFrom(e.target);
      if (!composer) return;
      const m = getText(composer).trim().match(SLASH);
      const { session: s } = latest.current;
      if (m) latest.current.open('slash', composer, m[1]);
      else if (s?.mode === 'slash' && s.composer === composer) latest.current.close(false);
    };

    // Capture on window so we see arrow/enter keys before the site sends the message.
    const onKeyDown = (e: KeyboardEvent) => {
      const { session: s } = latest.current;
      if (!s || s.mode !== 'slash' || e.isComposing || inPalette(e)) return;
      if (editableFrom(e.target) !== s.composer) return;
      if (latest.current.onListKey(e)) e.stopImmediatePropagation();
    };

    const onMouseDown = (e: MouseEvent) => {
      const { session: s } = latest.current;
      if (s && !inPalette(e) && editableFrom(e.target) !== s.composer) latest.current.close(false);
    };

    const onMessage = (msg: TabMessage) => {
      if (msg.type === 'open-palette') latest.current.open('hotkey', findComposer(), '');
    };

    document.addEventListener('input', onInput, true);
    window.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('mousedown', onMouseDown, true);
    window.addEventListener('resize', relayout);
    window.addEventListener('scroll', relayout, true);
    browser.runtime.onMessage.addListener(onMessage);
    return () => {
      document.removeEventListener('input', onInput, true);
      window.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('mousedown', onMouseDown, true);
      window.removeEventListener('resize', relayout);
      window.removeEventListener('scroll', relayout, true);
      browser.runtime.onMessage.removeListener(onMessage);
    };
  }, [host]);

  // Read the clipboard only when a prompt that needs it is chosen.
  const needsClipboard = currentBuiltins.includes('剪贴板');
  useEffect(() => {
    if (!session || !needsClipboard || clipboardTried.current) return;
    clipboardTried.current = true;
    void readClipboard().then((text) => setBuiltins((b) => ({ ...b, 剪贴板: text })));
  }, [session, needsClipboard]);

  useLayoutEffect(() => {
    if (formFocus) formRef.current?.querySelector<HTMLElement>('input, textarea, select, button')?.focus();
  }, [formFocus, current?.prompt.id]);

  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(null), 12_000);
    return () => window.clearTimeout(t);
  }, [notice]);

  const style = useMemo((): React.CSSProperties => {
    const rect = session?.composer?.getBoundingClientRect();
    const width = Math.min(window.innerWidth - 24, Math.max(rect?.width ?? 0, 640));
    if (!rect) return { left: (window.innerWidth - width) / 2, top: 96, width };
    const left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12));
    // Open above the composer (chat inputs sit at the bottom) unless there is no room.
    return rect.top > 380
      ? { left, width, bottom: window.innerHeight - rect.top + 8, maxHeight: rect.top - 24 }
      : { left, width, top: rect.bottom + 8, maxHeight: window.innerHeight - rect.bottom - 24 };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, hits.length, formFocus, active]);

  const setValue = (name: string, value: string) => {
    if (!current) return;
    setValues((all) => ({ ...all, [current.prompt.id]: { ...currentValues, [name]: value } }));
  };

  return (
    <>
      {session && (
        <div className="palette" style={style} role="dialog" aria-label="Promptory 提示词">
          <div className="head">
            <div className="logo">P</div>
            <b>Promptory</b>
            {session.mode === 'slash' ? (
              <span className="muted">{query ? `匹配「${query}」` : '输入快捷词或关键词筛选'}</span>
            ) : (
              <input
                className="search"
                autoFocus
                aria-label="搜索提示词"
                placeholder="搜索提示词…"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActive(0);
                }}
                onKeyDown={(e) => {
                  if (!e.nativeEvent.isComposing) onListKey(e);
                }}
              />
            )}
            <button className="link" onClick={() => void send({ type: 'openApp' })}>
              打开提示词库
            </button>
          </div>

          {!data ? (
            <div className="empty">加载中…</div>
          ) : hits.length === 0 ? (
            <div className="empty">
              {data.items.length === 0 ? '还没有提示词，点右上角打开提示词库新建' : `没有匹配「${query}」的提示词`}
            </div>
          ) : (
            <div className="body">
              <div className="list" role="listbox" aria-label="提示词">
                {hits.map((h, i) => (
                  <button
                    key={h.item.prompt.id}
                    role="option"
                    aria-selected={h.item === current}
                    className={`item${h.item === current ? ' active' : ''}`}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setActive(i);
                      setFormFocus(h.item.version.variables.length > 0);
                      if (h.item.version.variables.length === 0 && h.item === current) insert(false);
                    }}
                  >
                    <span className="title">
                      {h.item.prompt.title}
                      {h.item.prompt.shortcut && <span className="shortcut"> /{h.item.prompt.shortcut}</span>}
                    </span>
                    <span className="sub">
                      {[
                        h.item.folderName,
                        `★ v${h.item.version.number}`,
                        h.item.version.variables.length ? `${h.item.version.variables.length} 个变量` : '无变量',
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </button>
                ))}
              </div>
              {current && (
                <div
                  className="form"
                  ref={formRef}
                  onKeyDown={(e) => {
                    if (e.nativeEvent.isComposing) return;
                    const t = e.target as HTMLElement;
                    if (e.key === 'Escape') {
                      e.preventDefault();
                      close(true);
                    } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey || t.tagName === 'INPUT')) {
                      e.preventDefault();
                      insert((e.metaKey || e.ctrlKey) && e.shiftKey);
                    }
                  }}
                >
                  {current.prompt.description && <div className="desc">{current.prompt.description}</div>}
                  <VariableForm
                    variables={current.version.variables}
                    values={currentValues}
                    onChange={setValue}
                    builtinNames={currentBuiltins}
                    builtinValues={builtins}
                    onBuiltinChange={(name: BuiltinName, value) => setBuiltins((b) => ({ ...b, [name]: value }))}
                  />
                  <button className="primary" onClick={() => insert(false)}>
                    {session.composer ? '插入输入框' : '复制到剪贴板'}
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="foot">
            <span>↑↓ 选择</span>
            <span>Tab 填写变量</span>
            <span>↵ 插入</span>
            <span>⌘↵ 插入并发送</span>
            <span>Esc 关闭</span>
          </div>
        </div>
      )}

      {notice && (
        <div className="notice" role="status">
          <span>
            {notice.copied ? '已复制' : '已插入'}「{notice.title}」，效果如何？
          </span>
          <button
            onClick={() => {
              void send({ type: 'feedback', id: notice.id, version: notice.version, good: true });
              setNotice(null);
            }}
          >
            好用
          </button>
          <button
            onClick={() => {
              void send({ type: 'feedback', id: notice.id, version: notice.version, good: false });
              setNotice(null);
            }}
          >
            不好用
          </button>
          <button className="x" aria-label="关闭" onClick={() => setNotice(null)}>
            ×
          </button>
        </div>
      )}
    </>
  );
}

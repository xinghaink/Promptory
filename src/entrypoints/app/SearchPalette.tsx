import { useEffect, useMemo, useRef, useState } from 'react';
import { readClipboard } from '@/lib/clipboard';
import { relativeTime } from '@/lib/format';
import { searchPrompts } from '@/lib/search';
import { extractVariableNames } from '@/lib/variables';
import type { LibraryData } from './data';
import { go } from './route';

interface Props {
  data: LibraryData;
  onClose: () => void;
  onUse: (id: string) => void;
  onQuickSave: (text: string) => void;
  onTransfer: () => void;
}

interface Action {
  label: string;
  hint?: string;
  run: () => void | Promise<void>;
}

function highlight(text: string, query: string) {
  const term = query.trim().split(/\s+/)[0]?.replace(/^\//, '');
  const i = term ? text.toLowerCase().indexOf(term.toLowerCase()) : -1;
  if (i < 0) return text;
  return (
    <>
      {text.slice(0, i)}
      <mark className="hit">{text.slice(i, i + term.length)}</mark>
      {text.slice(i + term.length)}
    </>
  );
}

export function SearchPalette({ data, onClose, onUse, onQuickSave, onTransfer }: Props) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const hits = useMemo(() => {
    const items = data.prompts
      .filter((p) => p.deletedAt === null)
      .map((p) => ({
        prompt: p,
        content: data.recommended.get(p.id)?.content ?? '',
        folderName: p.folderId ? data.folderName.get(p.folderId) : undefined,
      }));
    return searchPrompts(items, query).slice(0, 8);
  }, [data, query]);

  const actions: Action[] = useMemo(() => {
    const all: Action[] = [
      { label: '新建提示词', hint: '⌘N', run: () => go('/new') },
      { label: '从剪贴板快速保存', run: async () => onQuickSave(await readClipboard()) },
      { label: '导入 / 导出', run: onTransfer },
      { label: '打开收件箱', run: () => go('/inbox') },
    ];
    const q = query.trim();
    return q ? all.filter((a) => a.label.includes(q)) : all;
  }, [query, onQuickSave, onTransfer]);

  const total = hits.length + actions.length;
  useEffect(() => setActive(0), [query]);
  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const choose = (index: number, edit = false) => {
    onClose();
    if (index < hits.length) {
      const id = hits[index].item.prompt.id;
      if (edit) go(`/edit/${id}`);
      else onUse(id);
    } else {
      void actions[index - hits.length]?.run();
    }
  };

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog palette" role="dialog" aria-modal="true" aria-label="快速搜索">
        <label className="palette-input">
          <svg width="20" height="20" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
            <circle cx="7" cy="7" r="4.5" />
            <path d="M10.5 10.5L14 14" />
          </svg>
          <input
            autoFocus
            aria-label="搜索提示词或命令"
            placeholder="搜索提示词、快捷词或命令…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.nativeEvent.isComposing) return;
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActive((a) => Math.min(total - 1, a + 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActive((a) => Math.max(0, a - 1));
              } else if (e.key === 'Enter' && total > 0) {
                e.preventDefault();
                choose(active, e.metaKey || e.ctrlKey);
              } else if (e.key === 'Escape') {
                onClose();
              }
            }}
          />
          <span className="kbd">Esc</span>
        </label>
        <div className="palette-list" ref={listRef} role="listbox" aria-label="搜索结果">
          {hits.length > 0 && <div className="palette-group">提示词</div>}
          {hits.map((h, i) => {
            const p = h.item.prompt;
            const vars = extractVariableNames(h.item.content).length;
            return (
              <button
                key={p.id}
                role="option"
                aria-selected={i === active}
                data-active={i === active}
                className={`palette-item${i === active ? ' active' : ''}`}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(i)}
              >
                <span className="main-col">
                  <b>
                    {highlight(p.title, query)}
                    {p.shortcut && <span className="small" style={{ color: 'var(--accent-strong)', fontWeight: 500 }}> /{p.shortcut}</span>}
                  </b>
                  <span className="sub">
                    {h.snippet
                      ? <>内容匹配：{highlight(h.snippet, query)}</>
                      : [h.item.folderName, vars ? `${vars} 个变量` : '', p.lastUsedAt ? `最近使用 ${relativeTime(p.lastUsedAt)}` : '']
                          .filter(Boolean)
                          .join(' · ')}
                  </span>
                </span>
                {i === active && <span className="small" style={{ color: 'var(--accent-strong)' }}>↵ 填写并使用</span>}
              </button>
            );
          })}
          {actions.length > 0 && <div className="palette-group">操作</div>}
          {actions.map((a, j) => {
            const i = hits.length + j;
            return (
              <button
                key={a.label}
                role="option"
                aria-selected={i === active}
                data-active={i === active}
                className={`palette-item${i === active ? ' active' : ''}`}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(i)}
              >
                <span className="main-col">{a.label}</span>
                {a.hint && <span className="small muted">{a.hint}</span>}
              </button>
            );
          })}
          {total === 0 && <div className="empty">没有找到「{query}」</div>}
        </div>
        <div className="palette-foot">
          <span>↑↓ 选择</span>
          <span>↵ 填写变量并使用</span>
          <span>⌘↵ 编辑</span>
        </div>
      </div>
    </div>
  );
}

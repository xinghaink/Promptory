import { useEffect, useMemo, useState } from 'react';
import { searchPrompts } from '@/lib/search';
import { MODEL_CHOICES, type Prompt } from '@/lib/types';
import { relativeTime } from '@/lib/format';
import { extractVariableNames } from '@/lib/variables';
import type { LibraryData } from './data';
import { Detail } from './Detail';
import { go, navHash, type Nav } from './route';
import { Sidebar } from './Sidebar';
import type { ShowToast } from './Toast';

type Sort = 'updated' | 'used' | 'title';

interface Props {
  data: LibraryData;
  nav: Nav;
  welcome: boolean;
  onUse: (id: string) => void;
  onOpenPalette: () => void;
  onOpenTransfer: () => void;
  onPasteNew: (text: string) => void;
  toast: ShowToast;
}

const NAV_TITLE: Record<Nav['kind'], string> = {
  all: '全部提示词',
  inbox: '收件箱',
  favorites: '收藏',
  recent: '最近使用',
  trash: '回收站',
  folder: '文件夹',
  tag: '标签',
};

function inNav(p: Prompt, nav: Nav): boolean {
  if (nav.kind === 'trash') return p.deletedAt !== null;
  if (p.deletedAt !== null) return false;
  switch (nav.kind) {
    case 'inbox':
      return p.inInbox;
    case 'favorites':
      return p.isFavorite;
    case 'recent':
      return p.lastUsedAt !== null;
    case 'folder':
      return p.folderId === nav.id;
    case 'tag':
      return p.tags.includes(nav.tag);
    default:
      return true;
  }
}

export function Library({ data, nav, welcome, onUse, onOpenPalette, onOpenTransfer, onPasteNew, toast }: Props) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<Sort>('updated');
  const [model, setModel] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showWelcome, setShowWelcome] = useState(welcome);

  const items = useMemo(() => {
    let list = data.prompts.filter((p) => inNav(p, nav) && (!model || p.models.includes(model)));
    if (nav.kind === 'recent') {
      list = list.sort((a, b) => (b.lastUsedAt ?? 0) - (a.lastUsedAt ?? 0)).slice(0, 20);
    } else if (sort === 'used') list = list.sort((a, b) => b.useCount - a.useCount);
    else if (sort === 'title') list = list.sort((a, b) => a.title.localeCompare(b.title, 'zh-CN'));
    else list = list.sort((a, b) => b.updatedAt - a.updatedAt);
    if (!query.trim()) return list.map((p) => ({ prompt: p, snippet: '' }));
    const searchable = list.map((p) => ({
      prompt: p,
      content: data.recommended.get(p.id)?.content ?? '',
      folderName: p.folderId ? data.folderName.get(p.folderId) : undefined,
    }));
    return searchPrompts(searchable, query).map((h) => ({ prompt: h.item.prompt, snippet: h.snippet }));
  }, [data, nav, query, sort, model]);

  const selected = items.find((i) => i.prompt.id === selectedId)?.prompt ?? items[0]?.prompt ?? null;

  // A new nav starts from the top of its list.
  const navKey = navHash(nav);
  useEffect(() => setSelectedId(null), [navKey]);

  const navTitle = nav.kind === 'folder' ? (data.folderName.get(nav.id) ?? '文件夹') : nav.kind === 'tag' ? `#${nav.tag}` : NAV_TITLE[nav.kind];

  return (
    <div className="shell">
      <Sidebar data={data} nav={nav} onOpenTransfer={onOpenTransfer} />
      <main className="main">
        <div className="topbar">
          <label className="searchbox">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
              <circle cx="7" cy="7" r="4.5" />
              <path d="M10.5 10.5L14 14" />
            </svg>
            <input aria-label="筛选提示词" placeholder="筛选标题、内容、标签、快捷词…" value={query} onChange={(e) => setQuery(e.target.value)} />
            <button className="link-btn" onClick={onOpenPalette} title="全局快速搜索">
              <span className="kbd">⌘K</span>
            </button>
          </label>
          <label className="inline-label">
            排序
            <select className="select" value={sort} onChange={(e) => setSort(e.target.value as Sort)} disabled={nav.kind === 'recent' || !!query.trim()}>
              <option value="updated">最近更新</option>
              <option value="used">最常使用</option>
              <option value="title">名称</option>
            </select>
          </label>
          <label className="inline-label">
            模型
            <select className="select" value={model} onChange={(e) => setModel(e.target.value)}>
              <option value="">全部</option>
              {MODEL_CHOICES.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </label>
          <button className="btn btn-primary" onClick={() => go(nav.kind === 'folder' ? `/new/${nav.id}` : '/new')}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M8 3v10M3 8h10" />
            </svg>
            新建
          </button>
        </div>

        {showWelcome && (
          <div className="notice notice-info" style={{ margin: '16px 16px 0', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <b>欢迎使用 Promptory！</b>已为你准备了 3 个示例提示词。试试这样用：
              <br />① 打开 ChatGPT、Claude、DeepSeek 等网站，在输入框里输入 <b>/zb</b>，填写变量后回车插入；
              <br />② 在任意网页选中一段提示词，右键「保存到 Promptory」；
              <br />③ 在这里按 <b>⌘K</b> 搜索，或直接 <b>⌘V</b> 粘贴来新建。
            </div>
            <button className="btn btn-sm btn-ghost" aria-label="关闭欢迎提示" onClick={() => setShowWelcome(false)}>
              ×
            </button>
          </div>
        )}

        <div className="library">
          <section className="list" aria-label="提示词列表">
            <div className="list-head">
              <span>
                {navTitle} · {items.length}
              </span>
              {nav.kind === 'inbox' && <span>收藏的提示词先放这里，整理后移出</span>}
              {nav.kind === 'trash' && <span>30 天后自动清除</span>}
            </div>
            {items.length === 0 ? (
              <div className="empty">
                {query ? (
                  '没有匹配的提示词'
                ) : nav.kind === 'inbox' ? (
                  '收件箱是空的。在网页上选中文字右键保存，或在这里按 ⌘V 粘贴。'
                ) : nav.kind === 'trash' ? (
                  '回收站是空的'
                ) : (
                  <>
                    还没有提示词。
                    <br />
                    <button className="link-btn" style={{ fontSize: 14 }} onClick={() => go('/new')}>
                      新建一个
                    </button>
                    ，或按 ⌘V 粘贴、
                    <button className="link-btn" style={{ fontSize: 14 }} onClick={onOpenTransfer}>
                      从其他工具导入
                    </button>
                    。
                  </>
                )}
              </div>
            ) : (
              items.map(({ prompt: p, snippet }) => {
                const version = data.recommended.get(p.id);
                const vars = version ? extractVariableNames(version.content).length : 0;
                return (
                  <button
                    key={p.id}
                    className={`card${selected?.id === p.id ? ' selected' : ''}`}
                    onClick={() => setSelectedId(p.id)}
                    onDoubleClick={() => p.deletedAt === null && onUse(p.id)}
                  >
                    <div className="card-title">
                      <span>
                        {p.isFavorite && <span aria-label="已收藏" style={{ color: '#b45309' }}>★ </span>}
                        {p.title}
                      </span>
                      <span className="time">{relativeTime(nav.kind === 'recent' ? p.lastUsedAt : p.updatedAt)}</span>
                    </div>
                    {(snippet || p.description) && <div className="card-desc">{snippet || p.description}</div>}
                    <div className="card-meta">
                      {p.folderId && <span className="chip">{data.folderName.get(p.folderId)}</span>}
                      {p.inInbox && <span className="chip chip-var">待整理</span>}
                      {vars > 0 && <span className="chip chip-var">{vars} 个变量</span>}
                      <span className="chip">v{p.recommendedVersion}</span>
                      {p.shortcut && <span className="chip">/{p.shortcut}</span>}
                      {p.draft && <span className="chip chip-builtin">有草稿</span>}
                    </div>
                  </button>
                );
              })
            )}
          </section>
          {selected ? (
            <Detail key={selected.id} prompt={selected} data={data} onUse={onUse} toast={toast} />
          ) : (
            <section className="detail">
              <div className="empty">
                选择左侧的提示词查看详情
                <br />
                <button className="link-btn" style={{ fontSize: 14 }} onClick={() => onPasteNew('')}>
                  或手动粘贴一段提示词保存
                </button>
              </div>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}

import { useMemo, useState } from 'react';
import { repo } from '@/lib/repo';
import type { LibraryData } from './data';
import { go, navHash, type Nav } from './route';

interface Props {
  data: LibraryData;
  nav: Nav;
  onOpenTransfer: () => void;
}

function same(a: Nav, b: Nav): boolean {
  return navHash(a) === navHash(b);
}

export function Sidebar({ data, nav, onOpenTransfer }: Props) {
  const [renaming, setRenaming] = useState<string | null>(null);
  const [newFolder, setNewFolder] = useState<string | null>(null);

  const counts = useMemo(() => {
    const active = data.prompts.filter((p) => p.deletedAt === null);
    const byFolder = new Map<string, number>();
    const tags = new Map<string, number>();
    for (const p of active) {
      if (p.folderId) byFolder.set(p.folderId, (byFolder.get(p.folderId) ?? 0) + 1);
      for (const t of p.tags) tags.set(t, (tags.get(t) ?? 0) + 1);
    }
    return {
      all: active.length,
      inbox: active.filter((p) => p.inInbox).length,
      favorites: active.filter((p) => p.isFavorite).length,
      recent: Math.min(20, active.filter((p) => p.lastUsedAt !== null).length),
      trash: data.prompts.length - active.length,
      byFolder,
      tags: [...tags.entries()].sort((a, b) => b[1] - a[1]).slice(0, 16),
    };
  }, [data.prompts]);

  const item = (target: Nav, label: string, count: number, badge = false) => (
    <a
      href={`#${navHash(target)}`}
      className={`nav-item${same(nav, target) ? ' active' : ''}`}
      aria-current={same(nav, target) ? 'page' : undefined}
    >
      <span>{label}</span>
      {badge && count > 0 ? <span className="badge">{count}</span> : <span className="count">{count}</span>}
    </a>
  );

  const submitNewFolder = async () => {
    if (newFolder?.trim()) {
      const f = await repo.createFolder(newFolder);
      go(navHash({ kind: 'folder', id: f.id }));
    }
    setNewFolder(null);
  };

  return (
    <nav className="sidebar" aria-label="主导航">
      <div className="brand">
        <div className="logo">P</div>
        Promptory
      </div>
      <div className="nav">
        {item({ kind: 'all' }, '全部提示词', counts.all)}
        {item({ kind: 'inbox' }, '收件箱 · 待整理', counts.inbox, true)}
        {item({ kind: 'favorites' }, '收藏', counts.favorites)}
        {item({ kind: 'recent' }, '最近使用', counts.recent)}
        {item({ kind: 'trash' }, '回收站', counts.trash)}
      </div>

      <div className="nav">
        <div className="nav-head">
          <span>文件夹</span>
          <button className="link-btn" aria-label="新建文件夹" style={{ fontSize: 16, color: 'var(--muted)' }} onClick={() => setNewFolder('')}>
            +
          </button>
        </div>
        {data.folders.map((f) =>
          renaming === f.id ? (
            <input
              key={f.id}
              className="input"
              aria-label="文件夹名称"
              defaultValue={f.name}
              autoFocus
              onBlur={async (e) => {
                await repo.renameFolder(f.id, e.target.value);
                setRenaming(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                if (e.key === 'Escape') setRenaming(null);
              }}
            />
          ) : (
            <div key={f.id} className={`nav-item${same(nav, { kind: 'folder', id: f.id }) ? ' active' : ''}`}>
              <a href={`#${navHash({ kind: 'folder', id: f.id })}`} className="nav-link">
                {f.name}
              </a>
              <span className="folder-actions">
                <button className="link-btn" aria-label={`重命名文件夹 ${f.name}`} onClick={() => setRenaming(f.id)}>
                  重命名
                </button>
                <button
                  className="link-btn"
                  style={{ color: 'var(--bad-text)' }}
                  aria-label={`删除文件夹 ${f.name}`}
                  onClick={async () => {
                    if (confirm(`删除文件夹「${f.name}」？其中的提示词会保留，变为未分类。`)) {
                      await repo.deleteFolder(f.id);
                      if (same(nav, { kind: 'folder', id: f.id })) go('/');
                    }
                  }}
                >
                  删除
                </button>
              </span>
              <span className="count">{counts.byFolder.get(f.id) ?? 0}</span>
            </div>
          ),
        )}
        {newFolder !== null && (
          <input
            className="input"
            aria-label="新文件夹名称"
            placeholder="文件夹名称，回车创建"
            autoFocus
            value={newFolder}
            onChange={(e) => setNewFolder(e.target.value)}
            onBlur={submitNewFolder}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void submitNewFolder();
              if (e.key === 'Escape') setNewFolder(null);
            }}
          />
        )}
      </div>

      {counts.tags.length > 0 && (
        <div className="nav">
          <div className="nav-head">
            <span>标签</span>
          </div>
          <div className="tag-cloud">
            {counts.tags.map(([t]) => {
              const target: Nav = { kind: 'tag', tag: t };
              const active = same(nav, target);
              return (
                <button key={t} className={`chip${active ? ' active' : ''}`} onClick={() => go(active ? '/' : navHash(target))}>
                  #{t}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="sidebar-foot">
        <div className="ext-card">
          <b>在 AI 网站中使用</b>
          <span>在输入框输入 / 或按 Alt+P 唤起；选中文字右键可保存</span>
        </div>
        <button className="nav-item" onClick={onOpenTransfer}>
          导入 / 导出
        </button>
      </div>
    </nav>
  );
}

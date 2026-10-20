import { useLiveQuery } from 'dexie-react-hooks';
import { ConfirmButton } from '@/components/ConfirmButton';
import { Highlighted } from '@/components/Highlighted';
import { copyText } from '@/lib/clipboard';
import { feedbackText, relativeTime } from '@/lib/format';
import { repo } from '@/lib/repo';
import type { Prompt } from '@/lib/types';
import { BUILTINS, extractBuiltinNames } from '@/lib/variables';
import type { LibraryData } from './data';
import { go } from './route';
import type { ShowToast } from './Toast';

interface Props {
  prompt: Prompt;
  data: LibraryData;
  onUse: (id: string) => void;
  toast: ShowToast;
}

const TYPE_LABEL = { text: '单行文本', textarea: '多行文本', select: '选项' } as const;

export function Detail({ prompt: p, data, onUse, toast }: Props) {
  const version = data.recommended.get(p.id);
  const latest = useLiveQuery(() => repo.getVersion(p.id, p.latestVersion), [p.id, p.latestVersion]);
  if (!version) return <section className="detail" />;

  const builtins = extractBuiltinNames(version.content);
  const trashed = p.deletedAt !== null;

  return (
    <section className="detail" aria-label="提示词详情">
      <div className="detail-head">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
          <h1>{p.title}</h1>
          <div className="small muted" style={{ lineHeight: 1.6 }}>
            {[
              p.folderId ? data.folderName.get(p.folderId) : '未分类',
              `★ 推荐版本 v${p.recommendedVersion}${p.latestVersion !== p.recommendedVersion ? `（最新 v${p.latestVersion}）` : ''}`,
              `已使用 ${p.useCount} 次`,
              feedbackText(version.goodCount, version.badCount),
              p.shortcut ? `快捷词 /${p.shortcut}` : '',
              p.models.length ? `适用 ${p.models.join(' / ')}` : '',
            ]
              .filter(Boolean)
              .join(' · ')}
          </div>
        </div>
        <div className="detail-actions">
          {trashed ? (
            <>
              <ConfirmButton
                className="btn btn-danger"
                label="彻底删除"
                confirmLabel="再点一次确认（无法撤销）"
                onConfirm={() => repo.purge(p.id)}
              />
              <button className="btn btn-primary" onClick={() => repo.restoreFromTrash(p.id).then(() => toast('已恢复'))}>
                恢复
              </button>
            </>
          ) : (
            <>
              <button
                className="btn btn-icon"
                aria-label={p.isFavorite ? '取消收藏' : '收藏'}
                aria-pressed={p.isFavorite}
                onClick={() => repo.updateMeta(p.id, { isFavorite: !p.isFavorite })}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" fill={p.isFavorite ? 'var(--star-fill)' : 'none'} stroke={p.isFavorite ? 'var(--star)' : 'var(--muted)'} strokeWidth="1.3">
                  <path d="M8 1.8l1.9 3.9 4.3.6-3.1 3 .7 4.3L8 11.6l-3.8 2 .7-4.3-3.1-3 4.3-.6z" />
                </svg>
              </button>
              <button className="btn" onClick={() => go(`/edit/${p.id}`)}>
                编辑
              </button>
              <button className="btn btn-primary" onClick={() => onUse(p.id)}>
                使用
              </button>
            </>
          )}
        </div>
      </div>

      {p.inInbox && !trashed && (
        <div className="notice notice-warn" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <span style={{ flex: 1 }}>这条提示词在收件箱中。整理好后放进文件夹：</span>
          <select
            className="select"
            aria-label="移动到文件夹"
            defaultValue=""
            onChange={(e) => repo.updateMeta(p.id, { folderId: e.target.value || null, inInbox: false }).then(() => toast('已整理'))}
          >
            <option value="" disabled>
              选择文件夹…
            </option>
            {data.folders.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
          <button className="btn btn-sm" onClick={() => repo.updateMeta(p.id, { inInbox: false })}>
            不分类，直接移出
          </button>
        </div>
      )}

      {p.draft && !trashed && (
        <div className="notice notice-info">
          有未保存的草稿。<button className="link-btn" onClick={() => go(`/edit/${p.id}`)}>继续编辑</button>
        </div>
      )}

      {p.description && <div style={{ color: 'var(--text-3)', lineHeight: 1.6 }}>{p.description}</div>}

      <div className="field">
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span className="label">提示词内容（v{version.number}）</span>
          <button className="link-btn" onClick={() => copyText(version.content).then(() => toast('已复制原文'))}>
            直接复制原文
          </button>
        </div>
        <div className="prompt-box">
          <Highlighted content={version.content} />
        </div>
      </div>

      {(version.variables.length > 0 || builtins.length > 0) && (
        <div className="field">
          <span className="label">变量（{version.variables.length + builtins.length}）</span>
          <div className="var-grid">
            {version.variables.map((v) => (
              <div key={v.name} className="var-card">
                <b>{v.name}</b>
                <span className="small muted">
                  {TYPE_LABEL[v.type]}
                  {v.type === 'select' && v.options.length ? `：${v.options.join(' / ')}` : ''}
                </span>
              </div>
            ))}
            {builtins.map((b) => (
              <div key={b} className="var-card">
                <b style={{ color: 'var(--builtin-text)' }}>@{b}</b>
                <span className="small muted">自动填充{BUILTINS[b]}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {p.tags.length > 0 && (
        <div className="card-meta">
          {p.tags.map((t) => (
            <a key={t} className="chip" href={`#/tag/${encodeURIComponent(t)}`} style={{ textDecoration: 'none' }}>
              #{t}
            </a>
          ))}
        </div>
      )}
      {p.sourceUrl && (
        <div className="small muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          来源：
          <a href={p.sourceUrl} target="_blank" rel="noreferrer">
            {p.sourceUrl}
          </a>
        </div>
      )}

      <div className="detail-foot">
        <span>
          最后更新：{relativeTime(p.updatedAt)}
          {latest?.note ? ` ·「${latest.note}」` : ''}
        </span>
        <span style={{ display: 'flex', gap: 16 }}>
          {!trashed && (
            <button className="link-btn" style={{ color: 'var(--muted)', fontSize: 13 }} onClick={() => repo.moveToTrash(p.id).then(() => toast('已移到回收站'))}>
              移到回收站
            </button>
          )}
          <a href={`#/history/${p.id}`}>查看版本历史 →</a>
        </span>
      </div>
    </section>
  );
}

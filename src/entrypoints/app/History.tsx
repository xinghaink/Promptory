import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { db } from '@/lib/db';
import { diffLines, diffStats } from '@/lib/diff';
import { feedbackText, relativeTime } from '@/lib/format';
import { repo } from '@/lib/repo';
import type { ShowToast } from './Toast';

interface Props {
  id: string;
  onUse: (id: string, version: number) => void;
  toast: ShowToast;
}

export function History({ id, onUse, toast }: Props) {
  const prompt = useLiveQuery(() => db.prompts.get(id), [id]);
  const versions = useLiveQuery(() => repo.listVersions(id), [id]);
  const [selected, setSelected] = useState<number | null>(null);
  const [base, setBase] = useState<number | null>(null);

  const current = versions?.find((v) => v.number === selected) ?? versions?.[0];
  const baseNumber = base ?? (current ? versions?.find((v) => v.number < current.number)?.number : undefined);
  const baseVersion = versions?.find((v) => v.number === baseNumber);

  const lines = useMemo(
    () => (current ? diffLines(baseVersion?.content ?? '', current.content) : []),
    [current, baseVersion],
  );
  const stats = diffStats(lines);

  if (prompt === undefined || versions === undefined) return null;
  if (!prompt || !current) {
    return (
      <div className="empty">
        这条提示词不存在。<a href="#/">返回提示词库</a>
      </div>
    );
  }

  return (
    <div className="main" style={{ minHeight: '100vh' }}>
      <header className="pagebar">
        <a href={`#/edit/${id}`} className="btn btn-ghost">
          ← 返回编辑
        </a>
        <div className="divider" />
        <div className="title">{prompt.title} · 版本历史</div>
        <span className="spacer" />
        <label className="inline-label">
          对比
          <select
            className="select"
            value={baseNumber ?? ''}
            onChange={(e) => setBase(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">（空）</option>
            {versions
              .filter((v) => v.number !== current.number)
              .map((v) => (
                <option key={v.number} value={v.number}>
                  v{v.number}
                </option>
              ))}
          </select>
          → v{current.number}
        </label>
        <button className="btn" onClick={() => onUse(id, current.number)}>
          用 v{current.number} 试一次
        </button>
        {current.number !== prompt.recommendedVersion && (
          <button
            className="btn"
            onClick={() => repo.setRecommended(id, current.number).then(() => toast(`已将 v${current.number} 设为推荐版本`))}
          >
            设为推荐版本
          </button>
        )}
        {current.number !== prompt.latestVersion && (
          <button
            className="btn btn-dark"
            onClick={() =>
              repo.restoreVersion(id, current.number).then((v) => {
                setSelected(v.number);
                setBase(null);
                toast(`已恢复为新版本 v${v.number}`);
              })
            }
          >
            恢复 v{current.number} 为新版本
          </button>
        )}
      </header>

      <div className="workspace">
        <ol className="versions" aria-label="版本列表">
          {versions.map((v) => (
            <li key={v.id}>
              <button
                className={`version${v.number === current.number ? ' selected' : ''}`}
                aria-current={v.number === current.number}
                onClick={() => {
                  setSelected(v.number);
                  setBase(null);
                }}
              >
                <span className="row">
                  <b>
                    v{v.number}
                    {v.number === prompt.latestVersion ? ' · 最新' : ''}
                    {v.number === prompt.recommendedVersion ? ' · ★ 推荐' : ''}
                  </b>
                  <span className="small muted">{relativeTime(v.createdAt)}</span>
                </span>
                <span style={{ fontSize: 13, color: 'var(--text-2)' }}>{v.note || '（无修改说明）'}</span>
                <span className="small muted">
                  使用 {v.useCount} 次 · {feedbackText(v.goodCount, v.badCount)}
                </span>
              </button>
            </li>
          ))}
          <li className="small muted" style={{ padding: '8px 4px', lineHeight: 1.6 }}>
            每次保存生成一个新版本。「★ 推荐版本」是使用时默认的版本，默认跟随最新版本；把旧版本设为推荐后会固定在该版本，可以先改新版、试用好用后再设为推荐。恢复旧版本不会改写历史，而是生成新版本。
          </li>
        </ol>

        <section className="diff" aria-label="差异对比">
          <div className="diff-head">
            <b>
              {baseVersion ? `v${baseVersion.number}` : '空'} → v{current.number}
            </b>
            <span style={{ color: 'var(--good-text)' }}>+{stats.added} 行</span>
            <span style={{ color: 'var(--bad-text)' }}>−{stats.removed} 行</span>
          </div>
          <div className="diff-body">
            {lines.map((l, i) => (
              <div key={i} className={`diff-line ${l.kind}`}>
                <span className="no">{l.kind === 'add' ? '+' : l.kind === 'del' ? '−' : l.newNo}</span>
                <span>{l.text || ' '}</span>
              </div>
            ))}
          </div>
          <div className="diff-foot">
            v{current.number} 修改说明：{current.note || '无'} · 保存于 {relativeTime(current.createdAt)}
          </div>
        </section>
      </div>
    </div>
  );
}

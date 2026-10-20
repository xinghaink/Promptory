import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useState } from 'react';
import { Highlighted } from '@/components/Highlighted';
import { VariableForm } from '@/components/VariableForm';
import { copyText, readClipboard } from '@/lib/clipboard';
import { db } from '@/lib/db';
import { repo } from '@/lib/repo';
import { OPENABLE_SITES } from '@/lib/sites';
import {
  builtinValues,
  estimateTokens,
  extractBuiltinNames,
  initialValues,
  parseTemplate,
  renderTemplate,
  type BuiltinName,
} from '@/lib/variables';
import type { PendingFeedback } from './feedback';

interface Props {
  id: string;
  initialVersion?: number;
  onClose: () => void;
  onUsed: (feedback: PendingFeedback) => void;
}

export function UseDialog({ id, initialVersion, onClose, onUsed }: Props) {
  const prompt = useLiveQuery(() => db.prompts.get(id), [id]);
  const versions = useLiveQuery(() => repo.listVersions(id), [id]);
  const [versionNo, setVersionNo] = useState<number | null>(initialVersion ?? null);
  const version = versions?.find((v) => v.number === (versionNo ?? prompt?.recommendedVersion));

  const [values, setValues] = useState<Record<string, string>>({});
  const [builtins, setBuiltins] = useState<Record<string, string>>(() => builtinValues({}));
  const [remember, setRemember] = useState(true);
  const builtinNames = useMemo(() => (version ? extractBuiltinNames(version.content) : []), [version]);

  // (Re)fill the form whenever the version changes, keeping what was typed.
  const versionKey = version?.id;
  useEffect(() => {
    if (!version || !prompt) return;
    setValues((typed) => ({ ...initialValues(version.variables, prompt.lastValues), ...typed }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [versionKey]);

  const usesClipboard = builtinNames.includes('剪贴板');
  useEffect(() => {
    if (usesClipboard) void readClipboard().then((text) => setBuiltins((b) => ({ ...b, 剪贴板: text })));
  }, [usesClipboard]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        void finish();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!prompt || !versions || !version) return null;

  const output = renderTemplate(version.content, values, builtins);
  const missing = parseTemplate(output).filter((s) => s.kind === 'var').length;
  const usedValues = Object.fromEntries(version.variables.map((v) => [v.name, values[v.name] ?? '']));

  async function finish(openUrl?: string) {
    if (!prompt || !version) return;
    await copyText(output);
    if (openUrl) window.open(openUrl, '_blank', 'noopener');
    await repo.recordUse(prompt.id, version.number, usedValues, remember);
    onUsed({ id: prompt.id, version: version.number, title: prompt.title });
    onClose();
  }

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog" role="dialog" aria-modal="true" aria-label={`使用：${prompt.title}`}>
        <div className="dialog-head">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <h2>使用：{prompt.title}</h2>
            <span className="small muted">
              {version.variables.length ? `填写 ${version.variables.length} 个变量，右侧实时预览最终提示词` : '右侧是最终提示词'}
            </span>
          </div>
          {versions.length > 1 && (
            <label className="inline-label" style={{ marginLeft: 'auto' }}>
              版本
              <select className="select" value={version.number} onChange={(e) => setVersionNo(Number(e.target.value))}>
                {versions.map((v) => (
                  <option key={v.number} value={v.number}>
                    v{v.number}
                    {v.number === prompt.recommendedVersion ? ' ★ 推荐' : ''}
                    {v.number === prompt.latestVersion && v.number !== prompt.recommendedVersion ? '（最新）' : ''}
                  </option>
                ))}
              </select>
            </label>
          )}
          <button className={`btn btn-ghost btn-icon${versions.length > 1 ? '' : ' close'}`} aria-label="关闭" onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path d="M4 4l10 10M14 4L4 14" />
            </svg>
          </button>
        </div>

        <div className="dialog-split">
          <form className="form" onSubmit={(e) => e.preventDefault()}>
            <VariableForm
              variables={version.variables}
              values={values}
              onChange={(name, value) => setValues((v) => ({ ...v, [name]: value }))}
              builtinNames={builtinNames}
              builtinValues={builtins}
              onBuiltinChange={(name: BuiltinName, value) => setBuiltins((b) => ({ ...b, [name]: value }))}
              autoFocus
            />
            {version.variables.length > 0 && (
              <label className="check">
                <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                记住本次填写，下次自动带入
              </label>
            )}
          </form>
          <section className="preview" aria-label="最终提示词预览">
            <div style={{ display: 'flex', justifyContent: 'space-between' }} className="small muted">
              <b>预览</b>
              <span>约 {estimateTokens(output)} tokens</span>
            </div>
            <div className="preview-box">
              <Highlighted content={version.content} values={values} builtins={builtins} />
            </div>
            {missing > 0 && <div className="notice notice-warn">还有 {missing} 处变量未填写，会原样保留。</div>}
          </section>
        </div>

        <div className="dialog-foot">
          <span className="small muted">⌘↵ 复制 · Esc 关闭 · 使用后可在页面底部反馈「好用 / 不好用」</span>
          <span className="spacer" />
          <select
            className="select"
            aria-label="复制并打开 AI 网站"
            value=""
            onChange={(e) => e.target.value && void finish(e.target.value)}
          >
            <option value="">复制并打开…</option>
            {OPENABLE_SITES.map((s) => (
              <option key={s.url} value={s.url}>
                {s.name}
              </option>
            ))}
          </select>
          <button className="btn btn-primary" style={{ height: 44 }} onClick={() => void finish()}>
            复制到剪贴板
          </button>
        </div>
      </div>
    </div>
  );
}

import { useMemo, useState } from 'react';
import { applyCandidates, findVariableCandidates, suggestTags, suggestTitle } from '@/lib/capture';
import { repo } from '@/lib/repo';
import type { Folder, Prompt } from '@/lib/types';
import { TagsInput } from './TagsInput';

interface Props {
  initialText: string;
  sourceUrl?: string;
  folders: Folder[];
  onSaved: (prompt: Prompt, thenEdit: boolean) => void;
  onCancel?: () => void;
}

/** Quick save: suggests a title, tags and variables so saving needs no tidying up. */
export function CaptureForm({ initialText, sourceUrl = '', folders, onSaved, onCancel }: Props) {
  const [content, setContent] = useState(initialText);
  const [title, setTitle] = useState(() => suggestTitle(initialText));
  const [titleEdited, setTitleEdited] = useState(false);
  const [folderId, setFolderId] = useState('');
  const [tags, setTags] = useState(() => suggestTags(initialText));
  const [saving, setSaving] = useState(false);

  const candidates = useMemo(() => findVariableCandidates(content), [content]);
  // Keyed by the candidate's text so choices survive edits elsewhere in the content.
  const [choices, setChoices] = useState<Record<string, { on: boolean; name: string }>>({});
  const choice = (text: string, fallbackName: string) => choices[text] ?? { on: true, name: fallbackName };

  const save = async (thenEdit: boolean) => {
    if (!content.trim() || saving) return;
    setSaving(true);
    const chosen = candidates
      .map((c) => ({ text: c.text, name: choice(c.text, c.name).name.trim() || c.name, on: choice(c.text, c.name).on }))
      .filter((c) => c.on);
    const prompt = await repo.createPrompt({
      title,
      content: applyCandidates(content, chosen),
      folderId: folderId || null,
      inInbox: !folderId,
      tags,
      sourceUrl,
      note: '收藏',
    });
    onSaved(prompt, thenEdit);
  };

  return (
    <form
      className="dialog-body"
      onSubmit={(e) => {
        e.preventDefault();
        void save(false);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          void save(false);
        }
      }}
    >
      <label className="field">
        <span>标题（已自动生成，可修改）</span>
        <input
          className="input"
          value={title}
          autoFocus
          onChange={(e) => {
            setTitle(e.target.value);
            setTitleEdited(true);
          }}
        />
      </label>
      <label className="field">
        <span>内容</span>
        <textarea
          className="textarea"
          rows={7}
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            if (!titleEdited) setTitle(suggestTitle(e.target.value));
          }}
        />
      </label>

      {candidates.length > 0 && (
        <div className="capture-candidates">
          <div style={{ fontWeight: 600, color: 'var(--var-text)', fontSize: 13 }}>
            发现 {candidates.length} 处可替换内容，转为变量？
          </div>
          {candidates.map((c) => {
            const ch = choice(c.text, c.name);
            return (
              <div key={c.text} className="row">
                <input
                  type="checkbox"
                  aria-label={`把「${c.text}」转为变量`}
                  checked={ch.on}
                  onChange={(e) => setChoices({ ...choices, [c.text]: { ...ch, on: e.target.checked } })}
                />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>「{c.text}」</span>
                <span aria-hidden="true">→</span>
                <input
                  className="input"
                  style={{ height: 32 }}
                  aria-label={`「${c.text}」的变量名`}
                  value={ch.name}
                  disabled={!ch.on}
                  onChange={(e) => setChoices({ ...choices, [c.text]: { ...ch, name: e.target.value } })}
                />
              </div>
            );
          })}
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        <label className="field" style={{ flex: '1 1 160px' }}>
          <span>放入</span>
          <select className="select" value={folderId} onChange={(e) => setFolderId(e.target.value)}>
            <option value="">收件箱（稍后整理）</option>
            {folders.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </label>
        <div className="field" style={{ flex: '2 1 200px' }}>
          <span className="label">标签</span>
          <TagsInput tags={tags} onChange={setTags} />
        </div>
      </div>
      {sourceUrl && (
        <div className="small muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          来源：{sourceUrl}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {onCancel && (
          <button type="button" className="btn" onClick={onCancel}>
            取消
          </button>
        )}
        <span style={{ flex: 1 }} />
        <button type="button" className="btn" disabled={!content.trim() || saving} onClick={() => void save(true)}>
          保存后编辑
        </button>
        <button type="submit" className="btn btn-primary" disabled={!content.trim() || saving}>
          保存 <span className="small" style={{ opacity: 0.8 }}>⌘↵</span>
        </button>
      </div>
    </form>
  );
}

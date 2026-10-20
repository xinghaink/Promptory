import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useState } from 'react';
import { db } from '@/lib/db';
import { Highlighted } from '@/components/Highlighted';
import { TagsInput } from '@/components/TagsInput';
import { normalizeShortcut, repo } from '@/lib/repo';
import { MODEL_CHOICES, type Prompt, type Variable, type VariableType } from '@/lib/types';
import { BUILTINS, estimateTokens, syncVariables, type BuiltinName } from '@/lib/variables';
import type { LibraryData } from './data';
import { go } from './route';
import type { ShowToast } from './Toast';

interface Props {
  /** null creates a new prompt. */
  id: string | null;
  newFolderId?: string;
  data: LibraryData;
  onUse: (id: string) => void;
  toast: ShowToast;
}

interface Form {
  title: string;
  description: string;
  folderId: string | null;
  tags: string[];
  models: string[];
  shortcut: string;
  content: string;
  variables: Variable[];
}

const sameVars = (a: Variable[], b: Variable[]) => JSON.stringify(a) === JSON.stringify(b);

function useDebounced(effect: () => void, deps: unknown[], ms: number) {
  useEffect(() => {
    const t = window.setTimeout(effect, ms);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

export function Editor({ id, newFolderId, data, onUse, toast }: Props) {
  const prompt: Prompt | undefined = id ? data.prompts.find((p) => p.id === id) : undefined;
  const latest = useLiveQuery(
    () => (id && prompt ? repo.getVersion(id, prompt.latestVersion) : undefined),
    [id, prompt?.latestVersion],
  );
  // undefined while loading, so a just-created prompt doesn't flash "not found".
  const exists = useLiveQuery(async () => (id ? !!(await db.prompts.get(id)) : true), [id]);
  const [form, setForm] = useState<Form | null>(() =>
    id
      ? null
      : { title: '', description: '', folderId: newFolderId ?? null, tags: [], models: [], shortcut: '', content: '', variables: [] },
  );
  const [note, setNote] = useState('');
  const [conflict, setConflict] = useState<string | null>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  // Load once: start from the unsaved draft if there is one, else the latest version.
  useEffect(() => {
    if (form || !prompt || !latest) return;
    const base = prompt.draft ?? { content: latest.content, variables: latest.variables };
    setForm({
      title: prompt.title,
      description: prompt.description,
      folderId: prompt.folderId,
      tags: prompt.tags,
      models: prompt.models,
      shortcut: prompt.shortcut,
      content: base.content,
      variables: syncVariables(base.content, base.variables),
    });
  }, [form, prompt, latest]);

  const dirty = !!form && !!latest && (form.content !== latest.content || !sameVars(form.variables, latest.variables));

  // Metadata isn't versioned: save it as you type.
  useDebounced(
    () => {
      if (!form || !prompt) return;
      const patch: Parameters<typeof repo.updateMeta>[1] = {};
      if (form.title.trim() && form.title !== prompt.title) patch.title = form.title;
      if (form.description !== prompt.description) patch.description = form.description;
      if (form.folderId !== prompt.folderId) patch.folderId = form.folderId;
      if (form.tags.join('\n') !== prompt.tags.join('\n')) patch.tags = form.tags;
      if (form.models.join('\n') !== prompt.models.join('\n')) patch.models = form.models;
      if (!conflict && normalizeShortcut(form.shortcut) !== prompt.shortcut) patch.shortcut = form.shortcut;
      if (Object.keys(patch).length) void repo.updateMeta(prompt.id, patch);
    },
    [form?.title, form?.description, form?.folderId, form?.tags, form?.models, form?.shortcut, conflict],
    500,
  );

  // Content edits are kept as a draft until saved as a version.
  useDebounced(
    () => {
      if (!form || !prompt || !latest) return;
      if (!dirty) {
        if (prompt.draft) void repo.saveDraft(prompt.id, null);
      } else if (
        !prompt.draft ||
        prompt.draft.content !== form.content ||
        !sameVars(prompt.draft.variables, form.variables)
      ) {
        void repo.saveDraft(prompt.id, { content: form.content, variables: form.variables });
      }
    },
    [form?.content, form?.variables, dirty],
    600,
  );

  useDebounced(
    () => {
      if (!form) return;
      const s = normalizeShortcut(form.shortcut);
      if (!s) return setConflict(null);
      void repo.findByShortcut(s, id ?? undefined).then((other) => setConflict(other ? other.title : null));
    },
    [form?.shortcut],
    250,
  );

  const update = (patch: Partial<Form>) => setForm((f) => (f ? { ...f, ...patch } : f));

  const setContent = (content: string) =>
    setForm((f) => (f ? { ...f, content, variables: syncVariables(content, f.variables) } : f));

  const setVariable = (name: string, patch: Partial<Variable>) =>
    setForm((f) => (f ? { ...f, variables: f.variables.map((v) => (v.name === name ? { ...v, ...patch } : v)) } : f));

  /** Inserts at the cursor and selects `selectText` inside the inserted text. */
  const insert = (text: string, selectText?: string) => {
    const ta = textRef.current;
    if (!form || !ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    setContent(form.content.slice(0, start) + text + form.content.slice(end));
    requestAnimationFrame(() => {
      ta.focus();
      const offset = selectText ? text.indexOf(selectText) : text.length;
      ta.setSelectionRange(start + offset, start + offset + (selectText?.length ?? 0));
    });
  };

  const save = async () => {
    if (!form) return;
    if (!form.content.trim()) return toast('内容不能为空');
    if (!id) {
      const created = await repo.createPrompt({
        ...form,
        shortcut: conflict ? '' : form.shortcut,
        note: note || '初始版本',
      });
      toast('已创建');
      go(`/edit/${created.id}`);
      return;
    }
    if (!dirty) return toast('内容没有变化，无需保存新版本');
    const v = await repo.saveVersion(id, { content: form.content, variables: form.variables, note });
    setNote('');
    toast(`已保存为 v${v.number}`);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void save();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (id && exists === false) {
    return (
      <div className="empty">
        这条提示词不存在或已被彻底删除。<a href="#/">返回提示词库</a>
      </div>
    );
  }
  if (!form || (id && !prompt)) return null;

  const nextVersion = (prompt?.latestVersion ?? 0) + 1;

  return (
    <div className="main" style={{ minHeight: '100vh' }}>
      <header className="pagebar">
        <a href={prompt?.deletedAt ? '#/trash' : '#/'} className="btn btn-ghost">
          ← 返回提示词库
        </a>
        <div className="divider" />
        <div className="title">{id ? form.title || '未命名提示词' : '新建提示词'}</div>
        {id &&
          (dirty ? (
            <span className="status status-warn">草稿已自动保存，尚未生成版本</span>
          ) : (
            <span className="status status-good">已是最新版本 v{prompt?.latestVersion}</span>
          ))}
        <span className="spacer" />
        {id && (
          <>
            <a className="btn" href={`#/history/${id}`}>
              版本历史
            </a>
            <button className="btn" onClick={() => onUse(id)} title={dirty ? '使用的是已保存的推荐版本' : undefined}>
              使用
            </button>
          </>
        )}
        <button className="btn btn-primary" onClick={() => void save()} disabled={!!id && !dirty}>
          {id ? `保存为 v${nextVersion}` : '创建'} <span className="small" style={{ opacity: 0.8 }}>⌘S</span>
        </button>
      </header>

      <div className="workspace">
        <section className="primary" aria-label="内容编辑">
          <label className="field">
            <span>标题</span>
            <input
              className="input title-input"
              value={form.title}
              placeholder="给提示词起个好找的名字"
              autoFocus={!id}
              onChange={(e) => update({ title: e.target.value })}
            />
          </label>
          <div className="editor">
            <div className="editor-toolbar" role="toolbar" aria-label="编辑工具">
              <button className="btn btn-sm btn-var" onClick={() => insert('{{变量}}', '变量')}>
                插入变量 {'{{ }}'}
              </button>
              {(Object.keys(BUILTINS) as BuiltinName[]).map((b) => (
                <button key={b} className="btn btn-sm btn-builtin" title={`使用时自动填充${BUILTINS[b]}`} onClick={() => insert(`{{@${b}}}`)}>
                  @{b}
                </button>
              ))}
              <span className="stat">
                {form.content.length} 字 · 约 {estimateTokens(form.content)} tokens
              </span>
            </div>
            <div className="code-area">
              <div className="backdrop" ref={backdropRef} aria-hidden="true">
                <Highlighted content={form.content} />
                {'\n'}
              </div>
              <textarea
                ref={textRef}
                aria-label="提示词内容"
                spellCheck={false}
                value={form.content}
                placeholder={'在这里写提示词。用 {{变量名}} 表示每次使用时要填写的内容，例如：\n请把下面的文字翻译成 {{目标语言}}：\n{{@选中文本}}'}
                onChange={(e) => setContent(e.target.value)}
                onScroll={(e) => {
                  if (backdropRef.current) backdropRef.current.scrollTop = e.currentTarget.scrollTop;
                }}
              />
            </div>
          </div>
          <div className="small muted">
            输入 {'{{名称}}'} 自动识别为变量；{'{{@今天}}'} 等内置变量在使用时自动填充。⌘S 保存新版本。
          </div>
        </section>

        <aside className="aside" aria-label="属性面板">
          <div className="panel">
            <div className="panel-title">基本信息</div>
            <label className="field">
              <span>描述</span>
              <textarea className="textarea" rows={2} value={form.description} onChange={(e) => update({ description: e.target.value })} />
            </label>
            <label className="field">
              <span>文件夹</span>
              <select className="select" value={form.folderId ?? ''} onChange={(e) => update({ folderId: e.target.value || null })}>
                <option value="">未分类</option>
                {data.folders.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="field">
              <span className="label">标签</span>
              <TagsInput tags={form.tags} onChange={(tags) => update({ tags })} />
            </div>
            <div className="field">
              <span className="label">适用模型</span>
              <div className="toggle-row">
                {MODEL_CHOICES.map((m) => {
                  const on = form.models.includes(m);
                  return (
                    <button
                      key={m}
                      className={`toggle${on ? ' on' : ''}`}
                      aria-pressed={on}
                      onClick={() => update({ models: on ? form.models.filter((x) => x !== m) : [...form.models, m] })}
                    >
                      {m}
                    </button>
                  );
                })}
              </div>
            </div>
            <label className="field">
              <span>快捷词（在 AI 网站输入 / 加快捷词直接调用）</span>
              <input
                className="input"
                value={form.shortcut}
                placeholder="例如 zb"
                onChange={(e) => update({ shortcut: e.target.value })}
              />
              {conflict && <span className="small" style={{ color: 'var(--bad-text)' }}>已被「{conflict}」使用，请换一个</span>}
            </label>
          </div>

          <div className="panel">
            <div className="panel-title">
              <span>变量（自动识别 {form.variables.length} 个）</span>
              <span className="small muted" style={{ fontWeight: 400 }}>
                可设类型与默认值
              </span>
            </div>
            {form.variables.length === 0 ? (
              <div className="small muted">内容中还没有 {'{{变量}}'}。</div>
            ) : (
              <>
                <div className="var-row small muted">
                  <span>变量名</span>
                  <span>类型</span>
                  <span>默认值 / 选项</span>
                </div>
                {form.variables.map((v) => (
                  <div key={v.name} className="var-row">
                    <span className="name" title={v.name}>
                      {v.name}
                    </span>
                    <select
                      className="select"
                      aria-label={`${v.name}的类型`}
                      value={v.type}
                      onChange={(e) => setVariable(v.name, { type: e.target.value as VariableType })}
                    >
                      <option value="text">单行文本</option>
                      <option value="textarea">多行文本</option>
                      <option value="select">下拉选项</option>
                    </select>
                    {v.type === 'select' ? (
                      <input
                        className="input"
                        aria-label={`${v.name}的选项`}
                        placeholder="用逗号分隔"
                        defaultValue={v.options.join('，')}
                        onBlur={(e) =>
                          setVariable(v.name, {
                            options: e.target.value.split(/[,，]/).map((s) => s.trim()).filter(Boolean),
                          })
                        }
                      />
                    ) : (
                      <input
                        className="input"
                        aria-label={`${v.name}的默认值`}
                        placeholder="无"
                        value={v.default}
                        onChange={(e) => setVariable(v.name, { default: e.target.value })}
                      />
                    )}
                  </div>
                ))}
              </>
            )}
          </div>

          <label className="panel">
            <span className="panel-title">本次修改说明</span>
            <input
              className="input"
              value={note}
              placeholder="例如：增加量化要求（保存版本时记录）"
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
        </aside>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { db } from '@/lib/db';
import { repo } from '@/lib/repo';
import { exportBackup, exportMarkdown, importItems, parseImport, type ImportItem } from '@/lib/transfer';
import type { ShowToast } from './Toast';

interface Props {
  onClose: () => void;
  toast: ShowToast;
}

function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

const stamp = () => new Date().toISOString().slice(0, 10);

export function TransferDialog({ onClose, toast }: Props) {
  const [parsed, setParsed] = useState<{ name: string; items: ImportItem[] } | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const onFile = async (file: File | undefined) => {
    setError('');
    setParsed(null);
    if (!file) return;
    try {
      const items = parseImport(await file.text(), file.name);
      if (items.length === 0) setError('文件里没有识别到提示词');
      else setParsed({ name: file.name, items });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog dialog-sm" role="dialog" aria-modal="true" aria-label="导入 / 导出" onKeyDown={(e) => e.key === 'Escape' && onClose()}>
        <div className="dialog-head">
          <h2>导入 / 导出</h2>
          <button className="btn btn-ghost btn-icon close" aria-label="关闭" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="dialog-body">
          <div className="panel-title">导入</div>
          <div className="small muted" style={{ lineHeight: 1.7 }}>
            支持 Promptory 备份（JSON）、Raycast AI Commands（JSON，占位符会自动转换）、AIPRM 等工具导出的 CSV（需有 prompt / content /
            内容 列），以及 Markdown（每个「## 标题」为一条）。导入的内容会新增，不会覆盖现有提示词。
          </div>
          <input
            type="file"
            aria-label="选择要导入的文件"
            accept=".json,.csv,.md,.markdown,.txt"
            onChange={(e) => void onFile(e.target.files?.[0])}
          />
          {error && <div className="notice notice-bad">{error}</div>}
          {parsed && (
            <div className="notice notice-info">
              从 {parsed.name} 识别到 {parsed.items.length} 条：
              {parsed.items
                .slice(0, 5)
                .map((i) => `「${i.title}」`)
                .join('')}
              {parsed.items.length > 5 ? ' 等' : ''}
              <div style={{ marginTop: 8 }}>
                <button
                  className="btn btn-primary btn-sm"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    const n = await importItems(repo, parsed.items);
                    setBusy(false);
                    toast(`已导入 ${n} 条提示词`);
                    onClose();
                  }}
                >
                  导入 {parsed.items.length} 条
                </button>
              </div>
            </div>
          )}

          <div className="panel-title" style={{ marginTop: 8 }}>
            导出
          </div>
          <div className="small muted">数据只保存在本机浏览器中，建议定期导出备份。JSON 包含全部版本，可完整恢复。</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              className="btn"
              onClick={async () => download(`promptory-${stamp()}.json`, JSON.stringify(await exportBackup(db), null, 2), 'application/json')}
            >
              导出 JSON 备份
            </button>
            <button className="btn" onClick={async () => download(`promptory-${stamp()}.md`, await exportMarkdown(db), 'text/markdown')}>
              导出 Markdown
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

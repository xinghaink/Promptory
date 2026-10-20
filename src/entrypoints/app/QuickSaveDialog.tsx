import { CaptureForm } from '@/components/CaptureForm';
import type { Folder, Prompt } from '@/lib/types';

interface Props {
  text: string;
  folders: Folder[];
  onClose: () => void;
  onSaved: (prompt: Prompt, thenEdit: boolean) => void;
}

export function QuickSaveDialog({ text, folders, onClose, onSaved }: Props) {
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        className="dialog dialog-sm"
        role="dialog"
        aria-modal="true"
        aria-label="保存提示词"
        onKeyDown={(e) => e.key === 'Escape' && onClose()}
      >
        <div className="dialog-head">
          <div className="logo" style={{ width: 22, height: 22, fontSize: 12, borderRadius: 6 }}>
            P
          </div>
          <h2>保存提示词</h2>
          <button className="btn btn-ghost btn-icon close" aria-label="关闭" onClick={onClose}>
            ×
          </button>
        </div>
        <CaptureForm initialText={text} folders={folders} onSaved={onSaved} onCancel={onClose} />
      </div>
    </div>
  );
}

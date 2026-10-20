import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { browser } from 'wxt/browser';
import '@/assets/app.css';
import { CaptureForm } from '@/components/CaptureForm';
import { repo } from '@/lib/repo';
import type { Folder } from '@/lib/types';

interface PendingCapture {
  text: string;
  url: string;
}

/** Small window opened by the context menu / Alt+Shift+S to save selected text. */
function CapturePage() {
  const [capture, setCapture] = useState<PendingCapture | null>(null);
  const [folders, setFolders] = useState<Folder[] | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    void browser.storage.session.get('pendingCapture').then((r) => {
      setCapture((r.pendingCapture as PendingCapture | undefined) ?? { text: '', url: '' });
      void browser.storage.session.remove('pendingCapture');
    });
    void repo.listFolders().then(setFolders);
  }, []);

  if (!capture || !folders) return null;

  if (saved) {
    return (
      <div className="dialog-body" style={{ alignItems: 'center', textAlign: 'center', paddingTop: 48 }}>
        <div className="notice notice-good">已保存「{saved}」</div>
        <button className="btn" onClick={() => window.close()}>
          关闭
        </button>
      </div>
    );
  }

  return (
    <div style={{ background: 'var(--surface)', minHeight: '100vh' }}>
      <div className="dialog-head">
        <div className="logo" style={{ width: 22, height: 22, fontSize: 12, borderRadius: 6 }}>
          P
        </div>
        <h2>保存提示词</h2>
      </div>
      {!capture.text && (
        <div className="notice notice-warn" style={{ margin: '16px 20px 0' }}>
          没有读取到选中的文字，请把提示词粘贴到下方内容框。
        </div>
      )}
      <CaptureForm
        initialText={capture.text}
        sourceUrl={capture.url}
        folders={folders}
        onCancel={() => window.close()}
        onSaved={async (prompt, thenEdit) => {
          if (thenEdit) {
            await browser.runtime.sendMessage({ type: 'openApp', hash: `/edit/${prompt.id}` });
            window.close();
          } else {
            setSaved(prompt.title);
            window.setTimeout(() => window.close(), 1200);
          }
        }}
      />
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CapturePage />
  </StrictMode>,
);

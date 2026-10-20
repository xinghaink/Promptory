import { useEffect, useState } from 'react';
import { repo } from '@/lib/repo';
import { useLibrary } from './data';
import { Editor } from './Editor';
import { usePendingFeedback } from './feedback';
import { History } from './History';
import { Library } from './Library';
import { QuickSaveDialog } from './QuickSaveDialog';
import { go, useRoute } from './route';
import { SearchPalette } from './SearchPalette';
import { Toast, FeedbackBar, useToast } from './Toast';
import { TransferDialog } from './TransferDialog';
import { UseDialog } from './UseDialog';

function isEditable(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  return el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName);
}

export function App() {
  const route = useRoute();
  const data = useLibrary();
  const [toast, showToast] = useToast();
  const [pending, setPending] = usePendingFeedback();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [use, setUse] = useState<{ id: string; version?: number } | null>(null);
  const [captureText, setCaptureText] = useState<string | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);

  // `#/use/<id>` opens the use dialog, e.g. from the palette on an AI site.
  const routeUseId = route.page === 'library' ? route.useId : undefined;
  useEffect(() => {
    if (routeUseId) {
      setUse({ id: routeUseId });
      go('/');
    }
  }, [routeUseId]);

  useEffect(() => {
    void repo.purgeExpired();
  }, []);

  const anyDialog = paletteOpen || use !== null || captureText !== null || transferOpen;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((open) => !open);
      } else if (mod && e.key.toLowerCase() === 'n' && !anyDialog) {
        e.preventDefault();
        go('/new');
      }
    };
    // Pasting anywhere outside a field saves the clipboard as a new prompt.
    const onPaste = (e: ClipboardEvent) => {
      if (anyDialog || route.page !== 'library' || isEditable(e.target)) return;
      const text = e.clipboardData?.getData('text/plain') ?? '';
      if (text.trim()) {
        e.preventDefault();
        setCaptureText(text);
      }
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('paste', onPaste);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('paste', onPaste);
    };
  }, [anyDialog, route.page]);

  if (!data) return null;

  return (
    <>
      {route.page === 'library' && (
        <Library
          data={data}
          nav={route.nav}
          welcome={route.welcome ?? false}
          onUse={(id) => setUse({ id })}
          onOpenPalette={() => setPaletteOpen(true)}
          onOpenTransfer={() => setTransferOpen(true)}
          onPasteNew={(text) => setCaptureText(text)}
          toast={showToast}
        />
      )}
      {(route.page === 'edit' || route.page === 'new') && (
        <Editor
          key={route.page === 'edit' ? route.id : 'new'}
          id={route.page === 'edit' ? route.id : null}
          newFolderId={route.page === 'new' ? route.folderId : undefined}
          data={data}
          onUse={(id) => setUse({ id })}
          toast={showToast}
        />
      )}
      {route.page === 'history' && (
        <History id={route.id} onUse={(id, version) => setUse({ id, version })} toast={showToast} />
      )}

      {use && (
        <UseDialog
          id={use.id}
          initialVersion={use.version}
          onClose={() => setUse(null)}
          onUsed={(fb) => {
            setPending(fb);
            showToast('已复制到剪贴板');
          }}
        />
      )}
      {paletteOpen && (
        <SearchPalette
          data={data}
          onClose={() => setPaletteOpen(false)}
          onUse={(id) => setUse({ id })}
          onQuickSave={(text) => setCaptureText(text)}
          onTransfer={() => setTransferOpen(true)}
        />
      )}
      {captureText !== null && (
        <QuickSaveDialog
          text={captureText}
          folders={data.folders}
          onClose={() => setCaptureText(null)}
          onSaved={(prompt, thenEdit) => {
            setCaptureText(null);
            if (thenEdit) go(`/edit/${prompt.id}`);
            else {
              showToast(`已保存「${prompt.title}」到${prompt.inInbox ? '收件箱' : '文件夹'}`);
              go(prompt.inInbox ? '/inbox' : '/');
            }
          }}
        />
      )}
      {transferOpen && <TransferDialog onClose={() => setTransferOpen(false)} toast={showToast} />}

      {pending && !anyDialog && (
        <FeedbackBar
          pending={pending}
          onAnswer={async (good) => {
            await repo.giveFeedback(pending.id, pending.version, good);
            setPending(null);
            showToast('感谢反馈，已记录到该版本');
          }}
          onDismiss={() => setPending(null)}
        />
      )}
      <Toast message={toast} />
    </>
  );
}

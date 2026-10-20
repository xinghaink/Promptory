import { useCallback, useEffect, useRef, useState } from 'react';
import type { PendingFeedback } from './feedback';

export type ShowToast = (message: string) => void;

export function useToast(): [string | null, ShowToast] {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<number>(undefined);
  const show = useCallback((msg: string) => {
    setMessage(msg);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setMessage(null), 2600);
  }, []);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return [message, show];
}

export function Toast({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="toast-bar" role="status" style={{ bottom: 76 }}>
      {message}
    </div>
  );
}

interface FeedbackProps {
  pending: PendingFeedback;
  onAnswer: (good: boolean) => void;
  onDismiss: () => void;
}

export function FeedbackBar({ pending, onAnswer, onDismiss }: FeedbackProps) {
  return (
    <div className="toast-bar" role="region" aria-label="使用反馈">
      <span>
        上次使用「{pending.title}」v{pending.version} 效果如何？
      </span>
      <button className="btn btn-sm" onClick={() => onAnswer(true)}>
        好用
      </button>
      <button className="btn btn-sm" onClick={() => onAnswer(false)}>
        不好用
      </button>
      <button className="btn btn-sm btn-ghost" style={{ color: '#fff' }} aria-label="关闭反馈" onClick={onDismiss}>
        ×
      </button>
    </div>
  );
}

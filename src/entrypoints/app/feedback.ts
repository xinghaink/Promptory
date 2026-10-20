import { useCallback, useState } from 'react';

export interface PendingFeedback {
  id: string;
  version: number;
  title: string;
}

const KEY = 'promptory.pendingFeedback';

function load(): PendingFeedback | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as PendingFeedback) : null;
  } catch {
    return null;
  }
}

/** The last use waiting for a 好用 / 不好用 answer; survives reloads. */
export function usePendingFeedback() {
  const [pending, setPending] = useState<PendingFeedback | null>(load);
  const set = useCallback((value: PendingFeedback | null) => {
    setPending(value);
    try {
      if (value) localStorage.setItem(KEY, JSON.stringify(value));
      else localStorage.removeItem(KEY);
    } catch {
      // Storage may be unavailable; the bar still works for this session.
    }
  }, []);
  return [pending, set] as const;
}

export function relativeTime(ts: number | null, now = Date.now()): string {
  if (!ts) return '从未';
  const diff = now - ts;
  const min = 60_000;
  const hour = 60 * min;
  const day = 24 * hour;
  if (diff < min) return '刚刚';
  if (diff < hour) return `${Math.floor(diff / min)} 分钟前`;
  if (diff < day) return `${Math.floor(diff / hour)} 小时前`;
  if (diff < 2 * day) return '昨天';
  if (diff < 7 * day) return `${Math.floor(diff / day)} 天前`;
  const d = new Date(ts);
  const sameYear = d.getFullYear() === new Date(now).getFullYear();
  return sameYear ? `${d.getMonth() + 1} 月 ${d.getDate()} 日` : `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

export function feedbackText(good: number, bad: number): string {
  return good + bad === 0 ? '暂无反馈' : `好用 ${good} / 不好用 ${bad}`;
}

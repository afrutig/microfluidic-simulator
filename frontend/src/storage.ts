export type JobHistoryItem = { id: string; name: string; createdAt: string };

const KEY = "jobHistory";

export function loadHistory(): JobHistoryItem[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    if (Array.isArray(data)) return data;
  } catch {}
  return [];
}

export function saveHistory(items: JobHistoryItem[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {}
}

export function addHistory(item: JobHistoryItem) {
  const cur = loadHistory();
  cur.unshift(item);
  saveHistory(cur.slice(0, 50)); // cap length
}

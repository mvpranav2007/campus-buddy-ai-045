import type { UIMessage } from "ai";

const KEY = "scholar-chat-messages";

export function loadMessages(): UIMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as UIMessage[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveMessages(messages: UIMessage[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(messages));
  } catch {
    // ignore quota errors
  }
}

export function clearMessages() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
}
export function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function normalizeLookupKey(value: string): string {
  return value.trim().toLowerCase().replaceAll("ё", "е");
}

export function normalizeStatus(status: string): string {
  const normalized = status.trim().toLowerCase();
  if (["todo", "to-do", "backlog", "planned"].includes(normalized)) {
    return "todo";
  }
  if (["in-progress", "inprogress", "doing", "wip"].includes(normalized)) {
    return "in-progress";
  }
  if (["review", "qa", "ready-for-review"].includes(normalized)) {
    return "review";
  }
  if (["done", "completed", "closed"].includes(normalized)) {
    return "done";
  }
  return "todo";
}

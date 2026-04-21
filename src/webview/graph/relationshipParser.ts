import { normalizeLookupKey } from "../shared/html";

export function extractRelationshipEntries(
  body: string,
  knownIds: Set<string>,
  titleToId: Map<string, string>
): Array<{ targetId: string; label?: string }> {
  const section = extractMarkdownSection(body, "Отношения");
  if (!section) {
    return [];
  }

  const entries = new Map<string, string | undefined>();

  const pushEntry = (targetId: string | null, label?: string): void => {
    if (!targetId) {
      return;
    }

    const normalizedLabel = label?.trim() || undefined;
    const existingLabel = entries.get(targetId);
    if (!existingLabel || (!existingLabel.trim() && normalizedLabel)) {
      entries.set(targetId, normalizedLabel);
      return;
    }

    if (normalizedLabel && existingLabel && !existingLabel.includes(normalizedLabel)) {
      entries.set(targetId, `${existingLabel} • ${normalizedLabel}`);
    }
  };

  for (const match of section.matchAll(/\[\[([^\]]+)\]\]/g)) {
    const rawValue = match[1]?.trim();
    const targetId = resolveRelationshipTarget(rawValue, knownIds, titleToId);
    pushEntry(targetId);
  }

  const sectionLines = section.split(/\r?\n/);
  let currentTargetId: string | null = null;
  const currentLabelParts: string[] = [];

  const flushCurrent = (): void => {
    if (!currentTargetId) {
      currentLabelParts.length = 0;
      return;
    }

    const label = currentLabelParts.join(" ").trim();
    pushEntry(currentTargetId, label || undefined);
    currentTargetId = null;
    currentLabelParts.length = 0;
  };

  for (const line of sectionLines) {
    const trimmed = line.trim();
    const headingMatch = trimmed.match(/^#{3,6}\s+(.+?)\s*$/);
    if (headingMatch) {
      flushCurrent();
      currentTargetId = resolveRelationshipTarget(headingMatch[1], knownIds, titleToId);
      continue;
    }

    if (currentTargetId) {
      const labelLine = trimmed
        .replace(/^[-*+]\s+/, "")
        .replace(/^\d+[.)]\s+/, "")
        .trim();
      if (labelLine) {
        currentLabelParts.push(labelLine);
      }
    }
  }

  flushCurrent();

  const lines = section
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    const cleaned = line
      .replace(/^[-*+]\s+/, "")
      .replace(/^\d+[.)]\s+/, "")
      .trim();
    if (!cleaned) {
      continue;
    }

    const candidate = cleaned.split(/[—–:-]/, 1)[0]?.trim() ?? "";
    const targetId = resolveRelationshipTarget(candidate, knownIds, titleToId);
    const labelMatch = cleaned.match(/^[^—–:.-]+[—–:-]\s*(.+)$/);
    pushEntry(targetId, labelMatch?.[1]?.trim());
  }

  return [...entries.entries()].map(([targetId, label]) => ({ targetId, label }));
}

function extractMarkdownSection(body: string, heading: string): string {
  const lines = body.split(/\r?\n/);
  const normalizedHeading = normalizeLookupKey(heading);
  let startIndex = -1;

  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(/^(#{1,6})\s+(.+?)\s*$/);
    if (!match) {
      continue;
    }

    if (normalizeLookupKey(match[2]) === normalizedHeading) {
      startIndex = index + 1;
      break;
    }
  }

  if (startIndex === -1) {
    return "";
  }

  const sectionLines: string[] = [];
  for (let index = startIndex; index < lines.length; index += 1) {
    if (/^#{1,2}\s+/.test(lines[index])) {
      break;
    }
    sectionLines.push(lines[index]);
  }

  return sectionLines.join("\n");
}

function resolveRelationshipTarget(
  rawValue: string,
  knownIds: Set<string>,
  titleToId: Map<string, string>
): string | null {
  const value = rawValue
    .trim()
    .replace(/^#{1,6}\s+/, "")
    .replace(/^\[([^\]]+)\]\([^)]*\)$/, "$1")
    .replace(/[*_`]/g, "")
    .trim();
  if (!value) {
    return null;
  }

  if (knownIds.has(value)) {
    return value;
  }

  return titleToId.get(normalizeLookupKey(value)) ?? null;
}

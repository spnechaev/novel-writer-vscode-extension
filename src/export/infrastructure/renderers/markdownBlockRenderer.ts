import MarkdownIt from "markdown-it";
import type { RenderBlock } from "../../application/types/exportTypes";

const markdown = new MarkdownIt();

export function renderMarkdownToBlocks(markdownText: string): RenderBlock[] {
  const blocks: RenderBlock[] = [];
  const lines = markdownText.split(/\r?\n/);
  let paragraphBuffer: string[] = [];
  let orderedCounter = 0;

  const flushParagraph = (): void => {
    if (paragraphBuffer.length === 0) {
      return;
    }
    const text = renderInlineToText(paragraphBuffer.join(" ")).trim();
    if (text) {
      blocks.push({ kind: "paragraph", text });
    }
    paragraphBuffer = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      flushParagraph();
      orderedCounter = 0;
      blocks.push({ kind: "blank" });
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      flushParagraph();
      orderedCounter = 0;
      blocks.push({ kind: "heading", level: headingMatch[1].length, text: renderInlineToText(headingMatch[2]).trim() });
      continue;
    }

    const orderedMatch = line.match(/^\d+\.\s+(.+)$/);
    if (orderedMatch) {
      flushParagraph();
      orderedCounter += 1;
      blocks.push({ kind: "listItem", text: renderInlineToText(orderedMatch[1]).trim(), ordered: true, order: orderedCounter });
      continue;
    }

    const bulletMatch = line.match(/^[-*+]\s+(.+)$/);
    if (bulletMatch) {
      flushParagraph();
      orderedCounter = 0;
      blocks.push({ kind: "listItem", text: renderInlineToText(bulletMatch[1]).trim(), ordered: false });
      continue;
    }

    paragraphBuffer.push(line);
  }

  flushParagraph();
  return blocks;
}

function renderInlineToText(content: string): string {
  const root = markdown.parseInline(content, {});
  const children = root[0]?.children ?? [];
  if (children.length === 0) {
    return content;
  }

  const parts: string[] = [];
  for (const token of children) {
    if (token.type === "text" || token.type === "code_inline") {
      parts.push(token.content);
    } else if (token.type === "softbreak" || token.type === "hardbreak") {
      parts.push(" ");
    }
  }

  const normalized = parts.join("").replace(/\s+/g, " ").trim();
  return normalized || content;
}

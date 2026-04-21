import { Document, Packer, Paragraph, TextRun } from "docx";
import type { RenderBlock, TypographyConfig } from "../../application/types/exportTypes";

export async function renderDocxBuffer(blocks: RenderBlock[], typography: TypographyConfig): Promise<Buffer> {
  const bodySize = toHalfPoints(typography.bodyFontSizePt);
  const doc = new Document({
    sections: [{ children: blocks.map((block) => toDocxParagraph(block, typography.bodyFontFamily, bodySize)) }]
  });

  return Packer.toBuffer(doc);
}

function toDocxParagraph(block: RenderBlock, bodyFontFamily: string, bodySize: number): Paragraph {
  if (block.kind === "blank") {
    return new Paragraph({ children: [new TextRun("")] });
  }

  if (block.kind === "heading") {
    const size = Math.max(bodySize, bodySize + (7 - block.level) * 2);
    return new Paragraph({
      spacing: { after: 200, before: 120 },
      children: [new TextRun({ text: block.text, bold: true, font: bodyFontFamily, size })]
    });
  }

  if (block.kind === "listItem") {
    const prefix = block.ordered ? `${block.order ?? 1}. ` : "• ";
    return new Paragraph({
      spacing: { after: 120 },
      children: [new TextRun({ text: `${prefix}${block.text}`, font: bodyFontFamily, size: bodySize })]
    });
  }

  return new Paragraph({
    spacing: { after: 140 },
    children: [new TextRun({ text: block.text, font: bodyFontFamily, size: bodySize })]
  });
}

function toHalfPoints(points: number): number {
  return Math.round(points * 2);
}

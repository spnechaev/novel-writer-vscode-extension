import PDFDocument from "pdfkit";
import type { RenderBlock, TypographyConfig } from "../../application/types/exportTypes";

export async function renderPdfBuffer(blocks: RenderBlock[], typography: TypographyConfig): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const pdf = new PDFDocument({ margin: 40 });
    const baseFont = toPdfFont(typography.bodyFontFamily);
    const chunks: Uint8Array[] = [];

    pdf.on("data", (chunk: Uint8Array) => chunks.push(chunk));
    pdf.on("end", () => resolve(Buffer.concat(chunks.map((c) => Buffer.from(c)))));
    pdf.on("error", reject);

    writePdfBlocks(pdf, blocks, typography.bodyFontSizePt, baseFont);
    pdf.end();
  });
}

function writePdfBlocks(pdf: InstanceType<typeof PDFDocument>, blocks: RenderBlock[], bodySizePt: number, baseFont: string): void {
  for (const block of blocks) {
    if (block.kind === "blank") {
      pdf.moveDown(0.5);
      continue;
    }

    if (block.kind === "heading") {
      const headingSize = Math.max(bodySizePt, bodySizePt + (7 - block.level));
      pdf.font(baseFont).fontSize(headingSize).text(block.text);
      pdf.moveDown(0.45);
      continue;
    }

    if (block.kind === "listItem") {
      const prefix = block.ordered ? `${block.order ?? 1}. ` : "• ";
      pdf.font(baseFont).fontSize(bodySizePt).text(`${prefix}${block.text}`);
      pdf.moveDown(0.25);
      continue;
    }

    pdf.font(baseFont).fontSize(bodySizePt).text(block.text);
    pdf.moveDown(0.3);
  }
}

function toPdfFont(fontFamily: string): string {
  const normalized = fontFamily.toLowerCase();
  if (normalized.includes("times")) {
    return "Times-Roman";
  }
  if (normalized.includes("courier")) {
    return "Courier";
  }
  if (normalized.includes("helvetica") || normalized.includes("arial")) {
    return "Helvetica";
  }
  return "Helvetica";
}

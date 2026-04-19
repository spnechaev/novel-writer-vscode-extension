import * as path from "node:path";
import * as vscode from "vscode";
import { Document, Packer, Paragraph, TextRun } from "docx";
import PDFDocument from "pdfkit";
import MarkdownIt from "markdown-it";
import { MarkdownRepository } from "../storage/markdownRepository";
import { PROJECT_PATHS } from "../storage/projectPaths";

type TypographyConfig = {
  bodyFontFamily: string;
  bodyFontSizePt: number;
};

type RenderBlock =
  | { kind: "heading"; text: string; level: number }
  | { kind: "paragraph"; text: string }
  | { kind: "listItem"; text: string; ordered: boolean; order?: number }
  | { kind: "blank" };

export class ExportService {
  private readonly markdown = new MarkdownIt();

  constructor(private readonly repository: MarkdownRepository, private readonly workspaceRoot: string) {}

  async exportDocx(): Promise<void> {
    const markdown = await this.buildOrderedManuscriptMarkdown();
    const blocks = this.renderMarkdownToBlocks(markdown);
    const typography = await this.readTypographyConfig();
    const bodySize = this.toHalfPoints(typography.bodyFontSizePt);

    const doc = new Document({
      sections: [
        {
          children: blocks.map((block) => this.toDocxParagraph(block, typography.bodyFontFamily, bodySize))
        }
      ]
    });

    const buffer = await Packer.toBuffer(doc);
    const target = this.toUri("book-project/exports/manuscript.docx");
    await vscode.workspace.fs.createDirectory(this.toUri("book-project/exports"));
    await vscode.workspace.fs.writeFile(target, buffer);
    await vscode.window.showInformationMessage("DOCX export complete: book-project/exports/manuscript.docx");
  }

  async exportPdf(): Promise<void> {
    const markdown = await this.buildOrderedManuscriptMarkdown();
    const blocks = this.renderMarkdownToBlocks(markdown);
    const typography = await this.readTypographyConfig();
    const target = this.toUri("book-project/exports/manuscript.pdf");
    await vscode.workspace.fs.createDirectory(this.toUri("book-project/exports"));

    await new Promise<void>((resolve, reject) => {
      const pdf = new PDFDocument({ margin: 40 });
      const baseFont = this.toPdfFont(typography.bodyFontFamily);
      const chunks: Uint8Array[] = [];

      pdf.on("data", (chunk: Uint8Array) => chunks.push(chunk));
      pdf.on("end", async () => {
        try {
          const merged = Buffer.concat(chunks.map((c) => Buffer.from(c)));
          await vscode.workspace.fs.writeFile(target, merged);
          resolve();
        } catch (error) {
          reject(error);
        }
      });
      pdf.on("error", reject);

      this.writePdfBlocks(pdf, blocks, typography.bodyFontSizePt, baseFont);

      pdf.end();
    });

    await vscode.window.showInformationMessage("PDF export complete: book-project/exports/manuscript.pdf");
  }

  private async buildOrderedManuscriptMarkdown(): Promise<string> {
    const index = await this.repository.readIndex();
    const chapters = index.entities
      .filter((e) => e.frontmatter.type === "chapter")
      .sort((a, b) => String(a.frontmatter.id).localeCompare(String(b.frontmatter.id)));

    const scenes = index.entities
      .filter((e) => e.frontmatter.type === "scene")
      .sort((a, b) => String(a.frontmatter.id).localeCompare(String(b.frontmatter.id)));

    const lines: string[] = ["# Manuscript Export", ""];

    for (const chapter of chapters) {
      lines.push(`# ${String(chapter.frontmatter.title)}`);
      lines.push(chapter.body.trim());
      lines.push("");

      const chapterId = String(chapter.frontmatter.id);
      const chapterScenes = scenes.filter((s) => String(s.filePath).includes(`/${chapterId}/`));
      for (const scene of chapterScenes) {
        lines.push(`## ${String(scene.frontmatter.title)}`);
        lines.push(scene.body.trim());
        lines.push("");
      }
    }

    if (chapters.length === 0 && scenes.length > 0) {
      for (const scene of scenes) {
        lines.push(`## ${String(scene.frontmatter.title)}`);
        lines.push(scene.body.trim());
        lines.push("");
      }
    }

    return lines.join("\n");
  }

  private renderMarkdownToBlocks(markdown: string): RenderBlock[] {
    const blocks: RenderBlock[] = [];
    const lines = markdown.split(/\r?\n/);
    let paragraphBuffer: string[] = [];
    let orderedCounter = 0;

    const flushParagraph = (): void => {
      if (paragraphBuffer.length === 0) {
        return;
      }
      const text = this.renderInlineToText(paragraphBuffer.join(" ")).trim();
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
        blocks.push({
          kind: "heading",
          level: headingMatch[1].length,
          text: this.renderInlineToText(headingMatch[2]).trim()
        });
        continue;
      }

      const orderedMatch = line.match(/^\d+\.\s+(.+)$/);
      if (orderedMatch) {
        flushParagraph();
        orderedCounter += 1;
        blocks.push({
          kind: "listItem",
          text: this.renderInlineToText(orderedMatch[1]).trim(),
          ordered: true,
          order: orderedCounter
        });
        continue;
      }

      const bulletMatch = line.match(/^[-*+]\s+(.+)$/);
      if (bulletMatch) {
        flushParagraph();
        orderedCounter = 0;
        blocks.push({
          kind: "listItem",
          text: this.renderInlineToText(bulletMatch[1]).trim(),
          ordered: false
        });
        continue;
      }

      paragraphBuffer.push(line);
    }

    flushParagraph();
    return blocks;
  }

  private renderInlineToText(content: string): string {
    const root = this.markdown.parseInline(content, {});
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

  private toDocxParagraph(block: RenderBlock, bodyFontFamily: string, bodySize: number): Paragraph {
    if (block.kind === "blank") {
      return new Paragraph({ children: [new TextRun("")] });
    }

    if (block.kind === "heading") {
      const size = Math.max(bodySize, bodySize + (7 - block.level) * 2);
      return new Paragraph({
        spacing: { after: 200, before: 120 },
        children: [
          new TextRun({
            text: block.text,
            bold: true,
            font: bodyFontFamily,
            size
          })
        ]
      });
    }

    if (block.kind === "listItem") {
      const prefix = block.ordered ? `${block.order ?? 1}. ` : "• ";
      return new Paragraph({
        spacing: { after: 120 },
        children: [
          new TextRun({
            text: `${prefix}${block.text}`,
            font: bodyFontFamily,
            size: bodySize
          })
        ]
      });
    }

    return new Paragraph({
      spacing: { after: 140 },
      children: [
        new TextRun({
          text: block.text,
          font: bodyFontFamily,
          size: bodySize
        })
      ]
    });
  }

  private writePdfBlocks(
    pdf: InstanceType<typeof PDFDocument>,
    blocks: RenderBlock[],
    bodySizePt: number,
    baseFont: string
  ): void {
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

  private async readTypographyConfig(): Promise<TypographyConfig> {
    const defaults: TypographyConfig = {
      bodyFontFamily: "Times New Roman",
      bodyFontSizePt: 12
    };

    const configUri = this.toUri(PROJECT_PATHS.exportTypographyConfig);
    try {
      const content = Buffer.from(await vscode.workspace.fs.readFile(configUri)).toString("utf8");
      const parsed = JSON.parse(content) as Partial<TypographyConfig>;
      const bodyFontFamily =
        typeof parsed.bodyFontFamily === "string" && parsed.bodyFontFamily.trim()
          ? parsed.bodyFontFamily.trim()
          : defaults.bodyFontFamily;
      const bodyFontSizePtRaw = Number(parsed.bodyFontSizePt);
      const bodyFontSizePt = Number.isFinite(bodyFontSizePtRaw) && bodyFontSizePtRaw >= 6 && bodyFontSizePtRaw <= 48
        ? bodyFontSizePtRaw
        : defaults.bodyFontSizePt;

      return {
        bodyFontFamily,
        bodyFontSizePt
      };
    } catch {
      return defaults;
    }
  }

  private toHalfPoints(points: number): number {
    return Math.round(points * 2);
  }

  private toPdfFont(fontFamily: string): string {
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

  private toUri(relativePath: string): vscode.Uri {
    return vscode.Uri.file(path.join(this.workspaceRoot, relativePath));
  }
}

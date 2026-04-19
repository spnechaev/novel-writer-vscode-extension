import * as path from "node:path";
import * as vscode from "vscode";
import { Document, Packer, Paragraph, TextRun } from "docx";
import PDFDocument from "pdfkit";
import { MarkdownRepository } from "../storage/markdownRepository";

export class ExportService {
  constructor(private readonly repository: MarkdownRepository, private readonly workspaceRoot: string) {}

  async exportDocx(): Promise<void> {
    const lines = await this.buildOrderedManuscriptLines();
    const doc = new Document({
      sections: [
        {
          children: lines.map((line) =>
            new Paragraph({
              children: [new TextRun(line)]
            })
          )
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
    const lines = await this.buildOrderedManuscriptLines();
    const target = this.toUri("book-project/exports/manuscript.pdf");
    await vscode.workspace.fs.createDirectory(this.toUri("book-project/exports"));

    await new Promise<void>((resolve, reject) => {
      const pdf = new PDFDocument({ margin: 40 });
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

      for (const line of lines) {
        pdf.text(line);
        pdf.moveDown(0.3);
      }

      pdf.end();
    });

    await vscode.window.showInformationMessage("PDF export complete: book-project/exports/manuscript.pdf");
  }

  private async buildOrderedManuscriptLines(): Promise<string[]> {
    const index = await this.repository.readIndex();
    const chapters = index.entities
      .filter((e) => e.frontmatter.type === "chapter")
      .sort((a, b) => String(a.frontmatter.id).localeCompare(String(b.frontmatter.id)));

    const scenes = index.entities
      .filter((e) => e.frontmatter.type === "scene")
      .sort((a, b) => String(a.frontmatter.id).localeCompare(String(b.frontmatter.id)));

    const lines: string[] = ["Manuscript Export", "=================", ""];

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

    return lines;
  }

  private toUri(relativePath: string): vscode.Uri {
    return vscode.Uri.file(path.join(this.workspaceRoot, relativePath));
  }
}


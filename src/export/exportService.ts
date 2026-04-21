import * as path from "node:path";
import * as vscode from "vscode";
import { FileSystemProjectRepository } from "../project/infrastructure/persistence/fileSystemProjectRepository";
import { buildOrderedManuscriptMarkdown } from "./application/queries/buildOrderedManuscript";
import { FileTypographyConfigRepository } from "./infrastructure/config/fileTypographyConfigRepository";
import { renderDocxBuffer } from "./infrastructure/renderers/docxRenderer";
import { renderMarkdownToBlocks } from "./infrastructure/renderers/markdownBlockRenderer";
import { renderPdfBuffer } from "./infrastructure/renderers/pdfRenderer";

export class ExportService {
  private readonly typographyConfigRepository: FileTypographyConfigRepository;

  constructor(private readonly repository: FileSystemProjectRepository, private readonly workspaceRoot: string) {
    this.typographyConfigRepository = new FileTypographyConfigRepository(workspaceRoot);
  }

  async exportDocx(): Promise<void> {
    const markdown = await buildOrderedManuscriptMarkdown(this.repository);
    const blocks = renderMarkdownToBlocks(markdown);
    const typography = await this.typographyConfigRepository.read();
    const buffer = await renderDocxBuffer(blocks, typography);
    const target = this.toUri("book-project/exports/manuscript.docx");
    await vscode.workspace.fs.createDirectory(this.toUri("book-project/exports"));
    await vscode.workspace.fs.writeFile(target, buffer);
    await vscode.window.showInformationMessage("DOCX export complete: book-project/exports/manuscript.docx");
  }

  async exportPdf(): Promise<void> {
    const markdown = await buildOrderedManuscriptMarkdown(this.repository);
    const blocks = renderMarkdownToBlocks(markdown);
    const typography = await this.typographyConfigRepository.read();
    const target = this.toUri("book-project/exports/manuscript.pdf");
    await vscode.workspace.fs.createDirectory(this.toUri("book-project/exports"));
    const buffer = await renderPdfBuffer(blocks, typography);
    await vscode.workspace.fs.writeFile(target, buffer);

    await vscode.window.showInformationMessage("PDF export complete: book-project/exports/manuscript.pdf");
  }

  private toUri(relativePath: string): vscode.Uri {
    return vscode.Uri.file(path.join(this.workspaceRoot, relativePath));
  }
}

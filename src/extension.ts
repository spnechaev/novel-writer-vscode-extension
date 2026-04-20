import * as path from "node:path";
import * as vscode from "vscode";
import { ProjectService } from "./domain/projectService";
import { LanguageDiagnostics } from "./diagnostics/languageDiagnostics";
import { ExportService } from "./export/exportService";
import { MarkdownRepository } from "./storage/markdownRepository";
import { BOOK_ROOT } from "./storage/projectPaths";
import { PanelProvider } from "./webview/panelProvider";

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    vscode.window.showWarningMessage("Open a workspace folder to use Book Project extension.");
    return;
  }

  const workspaceRoot = workspaceFolder.uri.fsPath;
  const repository = new MarkdownRepository(workspaceRoot);
  const projectService = new ProjectService(repository);
  const panelProvider = new PanelProvider(projectService);
  const exportService = new ExportService(repository, workspaceRoot);

  const diagnostics = new LanguageDiagnostics();
  diagnostics.activate(context);

  context.subscriptions.push(
    vscode.commands.registerCommand("bookProject.initialize", async () => {
      await projectService.initializeWorkspace();
      await openProjectReadme(workspaceRoot);
      vscode.window.showInformationMessage("Book project initialized.");
    }),
    vscode.commands.registerCommand("bookProject.createEntity", async () => {
      await projectService.createEntityInteractive();
    }),
    vscode.commands.registerCommand("bookProject.openBoard", async () => {
      await panelProvider.openBoard();
    }),
    vscode.commands.registerCommand("bookProject.openWritingSignals", async () => {
      await panelProvider.openWritingSignals();
    }),
    vscode.commands.registerCommand("bookProject.openRelationshipGraph", async () => {
      await panelProvider.openRelationshipGraph();
    }),
    vscode.commands.registerCommand("bookProject.exportDocx", async () => {
      await exportService.exportDocx();
    }),
    vscode.commands.registerCommand("bookProject.exportPdf", async () => {
      await exportService.exportPdf();
    }),
    vscode.workspace.onDidSaveTextDocument(async (doc) => {
      if (doc.uri.fsPath.includes(path.join(workspaceRoot, BOOK_ROOT))) {
        await vscode.commands.executeCommand("setContext", "bookProject.hasProject", true);
      }
    })
  );

  const projectUri = vscode.Uri.file(path.join(workspaceRoot, BOOK_ROOT, "project.md"));
  try {
    await vscode.workspace.fs.stat(projectUri);
    await vscode.commands.executeCommand("setContext", "bookProject.hasProject", true);
  } catch {
    await vscode.commands.executeCommand("setContext", "bookProject.hasProject", false);
  }
}

export function deactivate(): void {
  // noop
}

async function openProjectReadme(workspaceRoot: string): Promise<void> {
  const uri = vscode.Uri.file(path.join(workspaceRoot, BOOK_ROOT, "project.md"));
  const doc = await vscode.workspace.openTextDocument(uri);
  await vscode.window.showTextDocument(doc, { preview: false });
}

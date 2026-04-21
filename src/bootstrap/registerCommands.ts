import * as path from "node:path";
import * as vscode from "vscode";
import { BOOK_ROOT } from "../project/infrastructure/config/projectPaths";
import { ExtensionComposition } from "./compositionRoot";

export function registerExtensionCommands(
  context: vscode.ExtensionContext,
  workspaceRoot: string,
  composition: ExtensionComposition
): void {
  const { projectService, panelProvider, exportService } = composition;

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
    vscode.commands.registerCommand("bookProject.openRelationshipGraph", async () => {
      await panelProvider.openRelationshipGraph();
    }),
    vscode.commands.registerCommand("bookProject.openWritingSignals", async () => {
      await panelProvider.openWritingSignals();
    }),
    vscode.commands.registerCommand("bookProject.exportDocx", async () => {
      await exportService.exportDocx();
    }),
    vscode.commands.registerCommand("bookProject.exportPdf", async () => {
      await exportService.exportPdf();
    })
  );
}

async function openProjectReadme(workspaceRoot: string): Promise<void> {
  const uri = vscode.Uri.file(path.join(workspaceRoot, BOOK_ROOT, "project.md"));
  const doc = await vscode.workspace.openTextDocument(uri);
  await vscode.window.showTextDocument(doc, { preview: false });
}

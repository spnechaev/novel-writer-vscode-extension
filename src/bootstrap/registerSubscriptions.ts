import * as path from "node:path";
import * as vscode from "vscode";
import { BOOK_ROOT } from "../project/infrastructure/config/projectPaths";
import { ExtensionComposition } from "./compositionRoot";

export async function registerExtensionSubscriptions(
  context: vscode.ExtensionContext,
  workspaceRoot: string,
  composition: ExtensionComposition
): Promise<void> {
  composition.diagnostics.activate(context);
  await syncProjectContext(workspaceRoot);

  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(async (doc) => {
      if (doc.uri.fsPath.includes(path.join(workspaceRoot, BOOK_ROOT))) {
        await vscode.commands.executeCommand("setContext", "bookProject.hasProject", true);
      }
    })
  );
}

async function syncProjectContext(workspaceRoot: string): Promise<void> {
  const projectUri = vscode.Uri.file(path.join(workspaceRoot, BOOK_ROOT, "project.md"));

  try {
    await vscode.workspace.fs.stat(projectUri);
    await vscode.commands.executeCommand("setContext", "bookProject.hasProject", true);
  } catch {
    await vscode.commands.executeCommand("setContext", "bookProject.hasProject", false);
  }
}

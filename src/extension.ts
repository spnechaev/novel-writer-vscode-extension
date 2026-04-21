import * as vscode from "vscode";
import { createExtensionComposition } from "./bootstrap/compositionRoot";
import { registerExtensionCommands } from "./bootstrap/registerCommands";
import { registerExtensionSubscriptions } from "./bootstrap/registerSubscriptions";

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    vscode.window.showWarningMessage("Open a workspace folder to use Book Project extension.");
    return;
  }

  const workspaceRoot = workspaceFolder.uri.fsPath;
  const composition = createExtensionComposition(workspaceRoot, context.extensionUri);

  registerExtensionCommands(context, workspaceRoot, composition);
  await registerExtensionSubscriptions(context, workspaceRoot, composition);
}

export function deactivate(): void {
  // noop
}

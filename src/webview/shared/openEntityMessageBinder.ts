import * as path from "node:path";
import * as vscode from "vscode";
import { isAnalysisSignalKind, isAnalysisSignalStatus } from "../analysis/analysisHelpers";

export interface PanelMessageHandler {
  openEntity(filePath: string): Promise<void>;
  setSignalStatus(filePath: string, signalKind: string, status: string): Promise<void>;
}

export function bindOpenEntityMessages(panel: vscode.WebviewPanel, handler: PanelMessageHandler): void {
  panel.webview.onDidReceiveMessage(async (message: { type?: string; filePath?: string; signalId?: string; signalKind?: string; status?: string }) => {
    if (message.type === "openEntity") {
      if (typeof message.filePath !== "string" || !message.filePath.trim()) {
        return;
      }

      await handler.openEntity(message.filePath.trim());
      return;
    }

    if (message.type === "setSignalStatus") {
      if (
        typeof message.filePath !== "string" ||
        !message.filePath.trim() ||
        !isAnalysisSignalKind(message.signalKind) ||
        !isAnalysisSignalStatus(message.status)
      ) {
        return;
      }

      try {
        await handler.setSignalStatus(message.filePath.trim(), message.signalKind, message.status);
        await panel.webview.postMessage({
          type: "signalStatusSaved",
          signalId: typeof message.signalId === "string" ? message.signalId : "",
          status: message.status
        });
      } catch {
        vscode.window.showWarningMessage("Cannot update signal status.");
      }
    }
  });
}

export async function openEntityFile(filePath: string): Promise<void> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    vscode.window.showWarningMessage("Workspace folder not found.");
    return;
  }

  const targetUri = path.isAbsolute(filePath)
    ? vscode.Uri.file(filePath)
    : vscode.Uri.joinPath(workspaceFolder.uri, filePath);

  try {
    const doc = await vscode.workspace.openTextDocument(targetUri);
    await vscode.window.showTextDocument(doc, { preview: false });
  } catch {
    vscode.window.showWarningMessage(`Cannot open file: ${filePath}`);
  }
}

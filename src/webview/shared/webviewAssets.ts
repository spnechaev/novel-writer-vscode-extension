import * as vscode from "vscode";

export function getWebviewOptions(extensionUri?: vscode.Uri): vscode.WebviewOptions & vscode.WebviewPanelOptions {
  if (!extensionUri) {
    return { enableScripts: true };
  }

  return {
    enableScripts: true,
    localResourceRoots: [
      vscode.Uri.joinPath(extensionUri, "src", "webview", "styles"),
      vscode.Uri.joinPath(extensionUri, "node_modules", "cytoscape", "dist")
    ]
  };
}

export function getStylesheetUri(webview: vscode.Webview, extensionUri: vscode.Uri | undefined, fileName: string): string {
  if (!extensionUri) {
    return "";
  }

  return webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, "src", "webview", "styles", fileName)).toString();
}

export function getNodeModuleScriptUri(
  webview: vscode.Webview,
  extensionUri: vscode.Uri | undefined,
  modulePathSegments: string[]
): string {
  if (!extensionUri) {
    return "";
  }

  return webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, "node_modules", ...modulePathSegments)).toString();
}

import * as vscode from "vscode";

export function getWebviewOptions(extensionUri?: vscode.Uri): vscode.WebviewOptions & vscode.WebviewPanelOptions {
  if (!extensionUri) {
    return { enableScripts: true };
  }

  return {
    enableScripts: true,
    localResourceRoots: [vscode.Uri.joinPath(extensionUri, "src", "webview", "styles")]
  };
}

export function getStylesheetUri(webview: vscode.Webview, extensionUri: vscode.Uri | undefined, fileName: string): string {
  if (!extensionUri) {
    return "";
  }

  return webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, "src", "webview", "styles", fileName)).toString();
}

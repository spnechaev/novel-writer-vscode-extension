import * as vscode from "vscode";

const RU_FILLER_WORDS = ["очень", "как бы", "в общем"];
const EN_FILLER_WORDS = ["very", "really", "just"];

export class LanguageDiagnostics {
  private readonly collection = vscode.languages.createDiagnosticCollection("bookProject");

  activate(context: vscode.ExtensionContext): void {
    context.subscriptions.push(this.collection);

    context.subscriptions.push(
      vscode.workspace.onDidOpenTextDocument((doc) => this.refresh(doc)),
      vscode.workspace.onDidChangeTextDocument((event) => this.refresh(event.document)),
      vscode.workspace.onDidCloseTextDocument((doc) => this.collection.delete(doc.uri))
    );

    vscode.workspace.textDocuments.forEach((doc) => this.refresh(doc));
  }

  private refresh(document: vscode.TextDocument): void {
    if (document.languageId !== "markdown") {
      return;
    }

    const diagnostics: vscode.Diagnostic[] = [];
    const text = document.getText();
    const lines = text.split(/\r?\n/g);

    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i] ?? "";

      if (/\s[,.!?;:]/.test(line)) {
        const idx = line.search(/\s[,.!?;:]/);
        const range = new vscode.Range(i, Math.max(0, idx), i, Math.max(0, idx + 2));
        diagnostics.push(
          new vscode.Diagnostic(
            range,
            "Remove space before punctuation.",
            vscode.DiagnosticSeverity.Warning
          )
        );
      }

      if (line.length > 180) {
        const range = new vscode.Range(i, 0, i, line.length);
        diagnostics.push(
          new vscode.Diagnostic(
            range,
            "Long sentence/line can hurt readability.",
            vscode.DiagnosticSeverity.Information
          )
        );
      }

      this.pushFillerDiagnostics(line, i, RU_FILLER_WORDS, diagnostics, "RU filler word");
      this.pushFillerDiagnostics(line, i, EN_FILLER_WORDS, diagnostics, "EN filler word");
    }

    const repeatedPunctuation = /([!?.,])\1{2,}/g;
    let match: RegExpExecArray | null;
    while ((match = repeatedPunctuation.exec(text)) !== null) {
      const start = document.positionAt(match.index);
      const end = document.positionAt(match.index + match[0].length);
      diagnostics.push(
        new vscode.Diagnostic(
          new vscode.Range(start, end),
          "Repeated punctuation detected.",
          vscode.DiagnosticSeverity.Warning
        )
      );
    }

    this.collection.set(document.uri, diagnostics);
  }

  private pushFillerDiagnostics(
    line: string,
    lineIndex: number,
    fillers: string[],
    out: vscode.Diagnostic[],
    label: string
  ): void {
    const lower = line.toLowerCase();
    for (const filler of fillers) {
      const idx = lower.indexOf(filler);
      if (idx >= 0) {
        const range = new vscode.Range(lineIndex, idx, lineIndex, idx + filler.length);
        out.push(
          new vscode.Diagnostic(
            range,
            `${label}: "${filler}" may weaken style in this sentence.`,
            vscode.DiagnosticSeverity.Information
          )
        );
      }
    }
  }
}


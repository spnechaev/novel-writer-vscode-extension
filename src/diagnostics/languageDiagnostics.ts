import * as vscode from "vscode";
import { LanguageDiagnosticHint } from "../shared/types/languageDiagnostics";

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

    const diagnostics = analyzeMarkdownText(document.getText()).map((hint) => {
      const start = document.positionAt(hint.start);
      const end = document.positionAt(hint.end);
      return new vscode.Diagnostic(
        new vscode.Range(start, end),
        hint.message,
        hint.severity === "warning" ? vscode.DiagnosticSeverity.Warning : vscode.DiagnosticSeverity.Information
      );
    });

    this.collection.set(document.uri, diagnostics);
  }
}

export function analyzeMarkdownText(text: string): LanguageDiagnosticHint[] {
  const hints: LanguageDiagnosticHint[] = [];
  const lines = text.split(/\r?\n/g);
  let offset = 0;

  for (const line of lines) {
    const spaceBeforePunctuation = /\s[,.!?;:]/g;
    let spacingMatch: RegExpExecArray | null;
    while ((spacingMatch = spaceBeforePunctuation.exec(line)) !== null) {
      hints.push({
        kind: "space-before-punctuation",
        severity: "warning",
        message: "Remove space before punctuation.",
        start: offset + spacingMatch.index,
        end: offset + spacingMatch.index + spacingMatch[0].length,
        match: spacingMatch[0]
      });
    }

    pushFillerHints(line, offset, RU_FILLER_WORDS, hints, "RU filler word");
    pushFillerHints(line, offset, EN_FILLER_WORDS, hints, "EN filler word");
    offset += line.length + 1;
  }

  const repeatedPunctuation = /([!?.,])\1{2,}/g;
  let punctuationMatch: RegExpExecArray | null;
  while ((punctuationMatch = repeatedPunctuation.exec(text)) !== null) {
    hints.push({
      kind: "repeated-punctuation",
      severity: "warning",
      message: "Repeated punctuation detected.",
      start: punctuationMatch.index,
      end: punctuationMatch.index + punctuationMatch[0].length,
      match: punctuationMatch[0]
    });
  }

  return hints;
}

function pushFillerHints(
  line: string,
  lineOffset: number,
  fillers: string[],
  out: LanguageDiagnosticHint[],
  label: string
): void {
  const lower = line.toLowerCase();
  for (const filler of fillers) {
    let fromIndex = 0;
    while (fromIndex < lower.length) {
      const idx = lower.indexOf(filler, fromIndex);
      if (idx < 0) {
        break;
      }

      out.push({
        kind: "filler-word",
        severity: "info",
        message: `${label}: "${filler}" may weaken style in this sentence.`,
        start: lineOffset + idx,
        end: lineOffset + idx + filler.length,
        match: filler
      });
      fromIndex = idx + filler.length;
    }
  }
}

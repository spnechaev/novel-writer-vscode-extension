export type LanguageDiagnosticKind = "space-before-punctuation" | "filler-word" | "repeated-punctuation";

export type LanguageDiagnosticSeverity = "info" | "warning";

export interface LanguageDiagnosticHint {
  kind: LanguageDiagnosticKind;
  severity: LanguageDiagnosticSeverity;
  message: string;
  start: number;
  end: number;
  match: string;
}

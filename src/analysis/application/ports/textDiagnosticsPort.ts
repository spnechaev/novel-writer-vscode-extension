import type { LanguageDiagnosticHint } from "../../../shared/types/languageDiagnostics";

export interface TextDiagnosticsPort {
  analyzeMarkdownText(text: string): LanguageDiagnosticHint[];
}

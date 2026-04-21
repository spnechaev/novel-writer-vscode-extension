import { analyzeMarkdownText } from "../../../diagnostics/languageDiagnostics";
import type { TextDiagnosticsPort } from "../../application/ports/textDiagnosticsPort";

export class LanguageDiagnosticsAdapter implements TextDiagnosticsPort {
  analyzeMarkdownText(text: string) {
    return analyzeMarkdownText(text);
  }
}

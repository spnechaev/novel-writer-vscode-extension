import * as vscode from "vscode";
import { LanguageDiagnostics } from "../diagnostics/languageDiagnostics";
import { LanguageDiagnosticsAdapter } from "../analysis/infrastructure/diagnostics/languageDiagnosticsAdapter";
import { ProjectService } from "../domain/projectService";
import { ExportService } from "../export/exportService";
import { MarkdownRepository } from "../storage/markdownRepository";
import { VscodeUserInteraction } from "../project/presentation/vscode/vscodeUserInteraction";
import { PanelProvider } from "../webview/panelProvider";

export interface ExtensionComposition {
  projectService: ProjectService;
  panelProvider: PanelProvider;
  exportService: ExportService;
  diagnostics: LanguageDiagnostics;
}

export function createExtensionComposition(
  workspaceRoot: string,
  extensionUri: vscode.Uri
): ExtensionComposition {
  const repository = new MarkdownRepository(workspaceRoot);
  const userInteraction = new VscodeUserInteraction();
  const textDiagnostics = new LanguageDiagnosticsAdapter();
  const projectService = new ProjectService(repository, userInteraction, undefined, textDiagnostics);
  const panelProvider = new PanelProvider(projectService, extensionUri);
  const exportService = new ExportService(repository, workspaceRoot);
  const diagnostics = new LanguageDiagnostics();

  return {
    projectService,
    panelProvider,
    exportService,
    diagnostics
  };
}

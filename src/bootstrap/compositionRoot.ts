import * as vscode from "vscode";
import { LanguageDiagnostics } from "../diagnostics/languageDiagnostics";
import { LanguageDiagnosticsAdapter } from "../analysis/infrastructure/diagnostics/languageDiagnosticsAdapter";
import { ProjectApplicationService } from "../project/application/services/projectApplicationService";
import { ExportService } from "../export/exportService";
import { FileSystemProjectRepository } from "../project/infrastructure/persistence/fileSystemProjectRepository";
import { VscodeUserInteraction } from "../project/presentation/vscode/vscodeUserInteraction";
import { PanelProvider } from "../webview/panelProvider";

export interface ExtensionComposition {
  projectService: ProjectApplicationService;
  panelProvider: PanelProvider;
  exportService: ExportService;
  diagnostics: LanguageDiagnostics;
}

export function createExtensionComposition(
  workspaceRoot: string,
  extensionUri: vscode.Uri
): ExtensionComposition {
  const repository = new FileSystemProjectRepository(workspaceRoot);
  const userInteraction = new VscodeUserInteraction();
  const textDiagnostics = new LanguageDiagnosticsAdapter();
  const projectService = new ProjectApplicationService(repository, userInteraction, undefined, textDiagnostics);
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

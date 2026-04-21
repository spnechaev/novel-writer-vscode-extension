import type { AnalysisSignalKind, AnalysisSignalStatus } from "../../../analysis/domain/types/analysisTypes";
import { ProjectAnalyzer } from "../../../analysis/domain/services/projectAnalyzer";
import type { TextDiagnosticsPort } from "../../../analysis/application/ports/textDiagnosticsPort";
import type { FileSystemProjectRepository } from "../../infrastructure/persistence/fileSystemProjectRepository";
import type { UserInteractionPort } from "../ports/userInteractionPort";

export class ProjectApplicationService {
  constructor(
    private readonly repository: FileSystemProjectRepository,
    private readonly userInteraction: UserInteractionPort,
    private readonly analysis: ProjectAnalyzer | undefined = undefined,
    private readonly textDiagnostics?: TextDiagnosticsPort
  ) {}

  private getAnalyzer(): ProjectAnalyzer {
    return this.analysis ?? new ProjectAnalyzer(this.textDiagnostics);
  }

  async initializeWorkspace(): Promise<void> {
    await this.repository.initializeProject();
  }

  async createEntityInteractive(): Promise<void> {
    const selectedType = await this.userInteraction.pickEntityType([
      { label: "Character", value: "character" },
      { label: "Plotline", value: "plotline" },
      { label: "Relationship", value: "relationship" },
      { label: "Chapter", value: "chapter" },
      { label: "Scene", value: "scene" },
      { label: "Editorial Task", value: "editorialTask" },
      { label: "Checklist", value: "checklist" }
    ]);

    if (!selectedType) {
      return;
    }

    const title = await this.userInteraction.inputEntityTitle();
    if (!title) {
      return;
    }

    const uri = await this.repository.createEntity(selectedType, title.trim());
    await this.userInteraction.openCreatedEntity(uri.fsPath);
  }

  async getIndexJson(): Promise<string> {
    const index = await this.repository.readIndex();
    return JSON.stringify(index, null, 2);
  }

  async getAnalysis() {
    const index = await this.repository.readIndex();
    return this.getAnalyzer().analyze(index);
  }

  async getAnalysisJson(): Promise<string> {
    const analysis = await this.getAnalysis();
    return JSON.stringify(analysis, null, 2);
  }

  async setAnalysisSignalStatus(filePath: string, signalKind: AnalysisSignalKind, status: AnalysisSignalStatus): Promise<void> {
    await this.repository.updateAnalysisSignalStatus(filePath, signalKind, status);
  }
}

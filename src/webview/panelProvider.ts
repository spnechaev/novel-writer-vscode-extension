import * as vscode from "vscode";
import { AnalysisSignalKind, AnalysisSignalStatus } from "../analysis/domain/types/analysisTypes";
import { ProjectApplicationService } from "../project/application/services/projectApplicationService";
import { renderBoardHtml } from "./board/presentation/renderBoardHtml";
import { RelationshipGraphData, renderRelationshipGraphHtml } from "./graph/presentation/renderRelationshipGraphHtml";
import { extractRelationshipEntries } from "./graph/relationshipParser";
import { bindOpenEntityMessages, openEntityFile } from "./shared/openEntityMessageBinder";
import { normalizeLookupKey } from "./shared/html";
import { getNodeModuleScriptUri, getStylesheetUri, getWebviewOptions } from "./shared/webviewAssets";
import { renderWritingSignalsHtml } from "./writing-signals/presentation/renderWritingSignalsHtml";

export class PanelProvider {
  constructor(
    private readonly projectService: ProjectApplicationService,
    private readonly extensionUri?: vscode.Uri
  ) {}

  async openBoard(): Promise<void> {
    const panel = vscode.window.createWebviewPanel(
      "bookProjectBoard",
      "Story Board",
      vscode.ViewColumn.One,
      getWebviewOptions(this.extensionUri)
    );

    this.bindOpenEntity(panel);

    const data = await this.projectService.getIndexJson();
    panel.webview.html = renderBoardHtml(
      data,
      getStylesheetUri(panel.webview, this.extensionUri, "board.css")
    );
  }

  async openWritingSignals(): Promise<void> {
    const panel = vscode.window.createWebviewPanel(
      "bookProjectWritingSignals",
      "Writing Signals",
      vscode.ViewColumn.Beside,
      getWebviewOptions(this.extensionUri)
    );

    this.bindOpenEntity(panel);

    const data = await this.projectService.getAnalysisJson();
    panel.webview.html = renderWritingSignalsHtml(
      data,
      getStylesheetUri(panel.webview, this.extensionUri, "writingSignals.css")
    );
  }

  async openRelationshipGraph(): Promise<void> {
    const panel = vscode.window.createWebviewPanel(
      "bookProjectRelationshipGraph",
      "Relationship Graph",
      vscode.ViewColumn.Beside,
      getWebviewOptions(this.extensionUri)
    );

    this.bindOpenEntity(panel);

    const data = await this.projectService.getIndexJson();
    panel.webview.html = renderRelationshipGraphHtml(
      this.buildRelationshipGraphData(data),
      getStylesheetUri(panel.webview, this.extensionUri, "graph.css"),
      getNodeModuleScriptUri(panel.webview, this.extensionUri, ["cytoscape", "dist", "cytoscape.umd.js"])
    );
  }

  private bindOpenEntity(panel: vscode.WebviewPanel): void {
    bindOpenEntityMessages(panel, {
      openEntity: async (filePath) => openEntityFile(filePath),
      setSignalStatus: async (filePath, signalKind, status) => {
        await this.projectService.setAnalysisSignalStatus(
          filePath,
          signalKind as AnalysisSignalKind,
          status as AnalysisSignalStatus
        );
      }
    });
  }

  buildRelationshipGraphData(data: string): RelationshipGraphData {
    try {
      const parsed = JSON.parse(data) as {
        entities?: Array<{
          frontmatter?: Record<string, unknown>;
          filePath?: string;
          body?: string;
        }>;
      };

      const entities = Array.isArray(parsed.entities) ? parsed.entities : [];
      const graphEntities = entities.filter((entity) => {
        const type = entity.frontmatter?.type;
        return type === "character" || type === "plotline";
      });

      const nodes = graphEntities.map((entity) => ({
        id: typeof entity.frontmatter?.id === "string" ? entity.frontmatter.id : "unknown-id",
        label: typeof entity.frontmatter?.title === "string" ? entity.frontmatter.title : "Untitled",
        type: typeof entity.frontmatter?.type === "string" ? entity.frontmatter.type : "unknown",
        filePath: typeof entity.filePath === "string" ? entity.filePath : ""
      }));

      const knownIds = new Set(nodes.map((node) => node.id));
      const titleToId = new Map(nodes.map((node) => [normalizeLookupKey(node.label), node.id]));
      const edges = graphEntities
        .filter((entity) => entity.frontmatter?.type === "character")
        .flatMap((entity) => {
          const sourceId = typeof entity.frontmatter?.id === "string" ? entity.frontmatter.id : "unknown-id";
          return extractRelationshipEntries(entity.body ?? "", knownIds, titleToId).map((entry) => ({
            source: sourceId,
            target: entry.targetId,
            label: entry.label
          }));
        });

      return { nodes, edges };
    } catch {
      return { nodes: [], edges: [] };
    }
  }
}

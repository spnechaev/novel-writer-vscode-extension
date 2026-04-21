import * as path from "node:path";
import * as vscode from "vscode";
import { ProjectService } from "../domain/projectService";
import {
  AnalysisSignal,
  AnalysisSignalKind,
  EditorialPass,
  ProjectAnalysisResult
} from "../types";
import { normalizeSignalCard, countSignals, countSignalsByPass, isAnalysisSignalKind, isAnalysisSignalStatus } from "./analysis/analysisHelpers";
import { buildAnalysisViewModel } from "./analysis/buildAnalysisViewModel";
import { AnalysisTabId, AnalysisViewModel, SignalCard } from "./analysis/analysisViewTypes";
import { BoardCard } from "./board/boardTypes";
import { buildRelationshipGraphData } from "./graph/buildRelationshipGraphData";
import { GraphEdge, GraphNode } from "./graph/graphTypes";
import { escapeHtml, normalizeStatus } from "./shared/html";
import { extractSceneMeta, getMissingSceneFields, SceneMeta } from "./shared/sceneMeta";

export class PanelProvider {
  constructor(private readonly projectService: ProjectService) {}

  async openBoard(): Promise<void> {
    const panel = vscode.window.createWebviewPanel(
      "bookProjectBoard",
      "Story Board",
      vscode.ViewColumn.One,
      { enableScripts: true }
    );

    this.bindOpenEntity(panel);

    const data = await this.projectService.getIndexJson();
    panel.webview.html = this.renderBoardHtml(data);
  }

  async openWritingSignals(): Promise<void> {
    const panel = vscode.window.createWebviewPanel(
      "bookProjectWritingSignals",
      "Writing Signals",
      vscode.ViewColumn.Beside,
      { enableScripts: true }
    );

    this.bindOpenEntity(panel);

    const data = await this.projectService.getAnalysisJson();
    panel.webview.html = this.renderWritingSignalsHtml(data);
  }

  async openRelationshipGraph(): Promise<void> {
    const panel = vscode.window.createWebviewPanel(
      "bookProjectGraph",
      "Relationship Graph",
      vscode.ViewColumn.Beside,
      { enableScripts: true }
    );

    this.bindOpenEntity(panel);

    const data = await this.projectService.getIndexJson();
    panel.webview.html = this.renderGraphHtml(data);
  }

  private bindOpenEntity(panel: vscode.WebviewPanel): void {
    panel.webview.onDidReceiveMessage(async (message: { type?: string; filePath?: string; signalId?: string; signalKind?: string; status?: string }) => {
      if (message.type === "openEntity") {
        if (typeof message.filePath !== "string" || !message.filePath.trim()) {
          return;
        }

        await this.openEntityFile(message.filePath.trim());
        return;
      }

      if (message.type === "setSignalStatus") {
        if (
          typeof message.filePath !== "string" ||
          !message.filePath.trim() ||
          !isAnalysisSignalKind(message.signalKind) ||
          !isAnalysisSignalStatus(message.status)
        ) {
          return;
        }

        try {
          await this.projectService.setAnalysisSignalStatus(message.filePath.trim(), message.signalKind, message.status);
          await panel.webview.postMessage({
            type: "signalStatusSaved",
            signalId: typeof message.signalId === "string" ? message.signalId : "",
            status: message.status
          });
        } catch {
          vscode.window.showWarningMessage("Cannot update signal status.");
        }
      }
    });
  }

  private async openEntityFile(filePath: string): Promise<void> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      vscode.window.showWarningMessage("Workspace folder not found.");
      return;
    }

    const targetUri = path.isAbsolute(filePath)
      ? vscode.Uri.file(filePath)
      : vscode.Uri.joinPath(workspaceFolder.uri, filePath);

    try {
      const doc = await vscode.workspace.openTextDocument(targetUri);
      await vscode.window.showTextDocument(doc, { preview: false });
    } catch {
      vscode.window.showWarningMessage(`Cannot open file: ${filePath}`);
    }
  }

  private renderWritingSignalsHtml(data: string): string {
    const analysis = this.buildAnalysisViewModel(data);
    const analysisData = JSON.stringify(analysis);

    return `<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <style>
      :root {
        color-scheme: light dark;
      }

      body {
        margin: 0;
        padding: 16px;
        font-family: var(--vscode-font-family);
        color: var(--vscode-editor-foreground);
        background: var(--vscode-editor-background);
      }

      .header {
        display: grid;
        gap: 12px;
        margin-bottom: 16px;
      }

      .title {
        margin: 0;
        font-size: 18px;
      }

      .subtitle {
        margin: 4px 0 0 0;
        font-size: 12px;
        opacity: 0.78;
      }

      .stats,
      .tabs,
      .filters,
      .status-filters,
      .passes {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }

      .pill,
      .tab-btn,
      .filter-btn,
      .pass {
        border: 1px solid var(--vscode-panel-border);
        border-radius: 999px;
        padding: 4px 10px;
        font-size: 12px;
      }

      .tab-btn,
      .filter-btn {
        background: color-mix(in srgb, var(--vscode-editor-background) 88%, var(--vscode-editor-foreground) 12%);
        color: inherit;
        cursor: pointer;
      }

      .tab-btn.active,
      .filter-btn.active {
        border-color: var(--vscode-focusBorder);
        background: color-mix(in srgb, var(--vscode-button-background, var(--vscode-focusBorder)) 78%, var(--vscode-editor-background) 22%);
      }

      .toolbar {
        display: grid;
        gap: 10px;
        margin-bottom: 14px;
      }

      .toolbar-row {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
        align-items: center;
      }

      .toolbar-label {
        font-size: 12px;
        opacity: 0.78;
      }

      .cards {
        display: grid;
        gap: 12px;
      }

      .card {
        border: 1px solid var(--vscode-panel-border);
        border-left-width: 4px;
        border-radius: 10px;
        padding: 12px;
        background: color-mix(in srgb, var(--vscode-editor-background) 90%, var(--vscode-editor-foreground) 10%);
      }

      .card.critical {
        border-left-color: #ff6b6b;
      }

      .card.warning {
        border-left-color: #f4d35e;
      }

      .card.info {
        border-left-color: #4cc2ff;
      }

      .card-top,
      .card-meta,
      .card-actions {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        align-items: center;
      }

      .card-top {
        justify-content: space-between;
      }

      .card-title {
        margin: 0;
        font-size: 14px;
      }

      .card-text,
      .card-action-text {
        margin: 10px 0 0 0;
        font-size: 12px;
        line-height: 1.5;
        opacity: 0.92;
      }

      .card-action-text {
        opacity: 0.86;
      }

      .file {
        font-size: 11px;
        opacity: 0.75;
      }

      .badge {
        border-radius: 999px;
        padding: 2px 8px;
        font-size: 11px;
        border: 1px solid var(--vscode-panel-border);
      }

      .badge.group-forgotten {
        background: color-mix(in srgb, #ffcc66 18%, transparent);
      }

      .badge.group-looseEnd {
        background: color-mix(in srgb, #ff8fab 18%, transparent);
      }

      .open-btn {
        margin-top: 10px;
        border: 1px solid var(--vscode-button-border, var(--vscode-panel-border));
        background: var(--vscode-button-background, color-mix(in srgb, var(--vscode-editor-background) 82%, var(--vscode-editor-foreground) 18%));
        color: var(--vscode-button-foreground, var(--vscode-editor-foreground));
        border-radius: 6px;
        padding: 6px 10px;
        font-size: 12px;
        cursor: pointer;
      }

      .open-btn:hover {
        background: var(--vscode-button-hoverBackground, color-mix(in srgb, var(--vscode-editor-background) 72%, var(--vscode-editor-foreground) 28%));
      }

      .status-btn {
        border: 1px solid var(--vscode-panel-border);
        background: transparent;
        color: inherit;
        border-radius: 6px;
        padding: 5px 8px;
        font-size: 11px;
        cursor: pointer;
      }

      .status-btn.active {
        border-color: var(--vscode-focusBorder);
        background: color-mix(in srgb, var(--vscode-focusBorder) 18%, transparent);
      }

      .empty {
        padding: 18px 14px;
        border: 1px dashed var(--vscode-panel-border);
        border-radius: 10px;
        font-size: 13px;
        opacity: 0.75;
      }
    </style>
  </head>
  <body>
    <section class="header">
      <div>
        <h2 class="title">Writing Signals</h2>
        <p class="subtitle">Один экран, где видно, что забыто, что висит хвостом и в какой редакторский проход лучше влезть прямо сейчас.</p>
      </div>
      <div class="stats">
        <span class="pill">Сущностей: ${analysis.summary.entityCount}</span>
        <span class="pill">Сцен: ${analysis.summary.sceneCount}</span>
        <span class="pill">Сигналов: ${analysis.summary.signalCount}</span>
        <span class="pill">Критичных: ${analysis.summary.criticalCount}</span>
        <span class="pill">Предупреждений: ${analysis.summary.warningCount}</span>
      </div>
    </section>

    <section class="toolbar">
      <div id="tabs" class="tabs"></div>
      <div class="toolbar-row">
        <span class="toolbar-label">Серьёзность</span>
        <div id="filters" class="filters"></div>
      </div>
      <div class="toolbar-row">
        <span class="toolbar-label">Статус сигнала</span>
        <div id="statusFilters" class="status-filters"></div>
      </div>
    </section>

    <section id="cards" class="cards"></section>
    <section id="empty" class="empty" hidden>Для выбранного режима сигналов пока нет. Редкий случай: либо вы всё подчистили, либо текст ещё не успел наделать долгов.</section>

    <script>
      const vscode = acquireVsCodeApi();
      const analysis = ${analysisData};
      let activeTab = 'forgotten';
      let activeSeverity = 'all';
      let activeStatus = 'open';

      const cardsEl = document.getElementById('cards');
      const emptyEl = document.getElementById('empty');
      const tabsEl = document.getElementById('tabs');
      const filtersEl = document.getElementById('filters');
      const statusFiltersEl = document.getElementById('statusFilters');

      renderTabs();
      renderFilters();
      renderStatusFilters();
      renderCards();

      window.addEventListener('message', (event) => {
        const message = event.data || {};
        if (message.type !== 'signalStatusSaved') {
          return;
        }

        const signal = analysis.signals.find((item) => item.id === message.signalId);
        if (!signal) {
          return;
        }

        signal.status = message.status;
        renderCards();
      });

      function renderTabs() {
        tabsEl.innerHTML = analysis.tabs
          .map((tab) => {
            const active = tab.id === activeTab ? 'active' : '';
            return '<button class="tab-btn ' + active + '" type="button" data-tab="' + tab.id + '">' + escapeHtml(tab.label) + ' (' + tab.count + ')</button>';
          })
          .join('');

        tabsEl.querySelectorAll('[data-tab]').forEach((button) => {
          button.addEventListener('click', () => {
            activeTab = button.getAttribute('data-tab') || 'forgotten';
            renderTabs();
            renderCards();
          });
        });
      }

      function renderFilters() {
        const filters = [
          { id: 'all', label: 'Все' },
          { id: 'critical', label: 'Критично' },
          { id: 'warning', label: 'Предупреждения' },
          { id: 'info', label: 'Инфо' }
        ];

        filtersEl.innerHTML = filters
          .map((filter) => {
            const active = filter.id === activeSeverity ? 'active' : '';
            return '<button class="filter-btn ' + active + '" type="button" data-severity="' + filter.id + '">' + escapeHtml(filter.label) + '</button>';
          })
          .join('');

        filtersEl.querySelectorAll('[data-severity]').forEach((button) => {
          button.addEventListener('click', () => {
            activeSeverity = button.getAttribute('data-severity') || 'all';
            renderFilters();
            renderCards();
          });
        });
      }

      function renderStatusFilters() {
        const filters = [
          { id: 'open', label: 'Открытые' },
          { id: 'deferred', label: 'Отложенные' },
          { id: 'resolved', label: 'Закрытые' },
          { id: 'ignored', label: 'Игнор' },
          { id: 'all', label: 'Все статусы' }
        ];

        statusFiltersEl.innerHTML = filters
          .map((filter) => {
            const active = filter.id === activeStatus ? 'active' : '';
            return '<button class="filter-btn ' + active + '" type="button" data-status-filter="' + filter.id + '">' + escapeHtml(filter.label) + '</button>';
          })
          .join('');

        statusFiltersEl.querySelectorAll('[data-status-filter]').forEach((button) => {
          button.addEventListener('click', () => {
            activeStatus = button.getAttribute('data-status-filter') || 'open';
            renderStatusFilters();
            renderCards();
          });
        });
      }

      function renderCards() {
        const visibleSignals = analysis.signals.filter((signal) => matchesTab(signal) && matchesSeverity(signal) && matchesStatus(signal));

        if (!visibleSignals.length) {
          cardsEl.innerHTML = '';
          emptyEl.hidden = false;
          return;
        }

        emptyEl.hidden = true;
        cardsEl.innerHTML = visibleSignals
          .map((signal) => {
            const passes = (signal.passes || []).map((pass) => '<span class="pass">' + escapeHtml(renderPassLabel(pass)) + '</span>').join('');
            const encodedPath = encodeURIComponent(String(signal.filePath || ''));
            return (
              '<article class="card ' + escapeHtml(signal.severity) + '">' +
                '<div class="card-top">' +
                  '<h3 class="card-title">' + escapeHtml(signal.title) + '</h3>' +
                  '<span class="badge group-' + escapeHtml(signal.group) + '">' + escapeHtml(renderGroupLabel(signal.group)) + '</span>' +
                '</div>' +
                '<div class="card-meta">' +
                  '<span class="badge">' + escapeHtml(renderSeverityLabel(signal.severity)) + '</span>' +
                  '<span class="badge">Статус: ' + escapeHtml(signal.status) + '</span>' +
                  passes +
                '</div>' +
                '<p class="card-text">' + escapeHtml(signal.description) + '</p>' +
                '<p class="card-action-text">Что сделать: ' + escapeHtml(signal.suggestedAction) + '</p>' +
                '<div class="file">' + escapeHtml(signal.filePath) + '</div>' +
                '<div class="card-actions">' +
                  '<button class="open-btn" type="button" data-file-path="' + encodedPath + '">Открыть файл</button>' +
                  renderStatusButtons(signal) +
                '</div>' +
              '</article>'
            );
          })
          .join('');

        cardsEl.querySelectorAll('[data-file-path]').forEach((button) => {
          button.addEventListener('click', () => {
            const filePath = decodeURIComponent(button.getAttribute('data-file-path') || '');
            if (!filePath) {
              return;
            }
            vscode.postMessage({ type: 'openEntity', filePath });
          });
        });

        cardsEl.querySelectorAll('[data-signal-status]').forEach((button) => {
          button.addEventListener('click', () => {
            const signalId = button.getAttribute('data-signal-id') || '';
            const signalStatus = button.getAttribute('data-signal-status') || 'open';
            const signal = analysis.signals.find((item) => item.id === signalId);
            if (!signal) {
              return;
            }

            signal.status = signalStatus;
            vscode.postMessage({
              type: 'setSignalStatus',
              signalId: signal.id,
              filePath: signal.filePath,
              signalKind: signal.kind,
              status: signalStatus
            });
            renderCards();
          });
        });
      }

      function matchesTab(signal) {
        if (activeTab === 'forgotten') {
          return signal.group === 'forgotten';
        }
        if (activeTab === 'looseEnd') {
          return signal.group === 'looseEnd';
        }
        return Array.isArray(signal.passes) && signal.passes.includes(activeTab);
      }

      function matchesSeverity(signal) {
        return activeSeverity === 'all' ? true : signal.severity === activeSeverity;
      }

      function matchesStatus(signal) {
        return activeStatus === 'all' ? true : signal.status === activeStatus;
      }

      function renderStatusButtons(signal) {
        const statuses = [
          { id: 'open', label: 'Открыт' },
          { id: 'deferred', label: 'Отложить' },
          { id: 'resolved', label: 'Закрыть' },
          { id: 'ignored', label: 'Игнор' }
        ];

        return statuses
          .map((status) => {
            const active = signal.status === status.id ? 'active' : '';
            return '<button class="status-btn ' + active + '" type="button" data-signal-id="' + escapeHtml(signal.id) + '" data-signal-status="' + status.id + '">' + escapeHtml(status.label) + '</button>';
          })
          .join('');
      }

      function renderGroupLabel(group) {
        if (group === 'forgotten') {
          return 'Забытое';
        }
        if (group === 'looseEnd') {
          return 'Хвост';
        }
        return group;
      }

      function renderPassLabel(pass) {
        if (pass === 'logic') {
          return 'Логика';
        }
        if (pass === 'rhythm') {
          return 'Ритм';
        }
        if (pass === 'style') {
          return 'Стиль';
        }
        if (pass === 'texture') {
          return 'Фактура';
        }
        if (pass === 'repetition') {
          return 'Повторы';
        }
        return pass;
      }

      function renderSeverityLabel(severity) {
        if (severity === 'critical') {
          return 'Критично';
        }
        if (severity === 'warning') {
          return 'Предупреждение';
        }
        return 'Инфо';
      }

      function escapeHtml(value) {
        return String(value)
          .replaceAll('&', '&amp;')
          .replaceAll('<', '&lt;')
          .replaceAll('>', '&gt;')
          .replaceAll('"', '&quot;');
      }
    </script>
  </body>
</html>`;
  }

  private buildAnalysisViewModel(data: string): AnalysisViewModel {
    return buildAnalysisViewModel(data);
  }

  private renderBoardHtml(data: string): string {
    const boardCards = this.buildBoardCards(data);
    const boardData = JSON.stringify(boardCards);

    return `<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <style>
      :root {
        color-scheme: light dark;
      }

      body {
        margin: 0;
        padding: 16px;
        font-family: var(--vscode-font-family);
        color: var(--vscode-editor-foreground);
        background: var(--vscode-editor-background);
      }

      .header {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 16px;
      }

      .title {
        margin: 0;
        font-size: 18px;
      }

      .subtitle {
        margin: 0;
        font-size: 12px;
        opacity: 0.75;
      }

      .stats {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }

      .edge-details {
        margin: 10px 0 0 0;
        min-height: 18px;
        font-size: 12px;
        opacity: 0.78;
      }

      .controls {
        display: flex;
        gap: 6px;
        flex-wrap: wrap;
      }

      .tool-btn {
        border: 1px solid var(--vscode-button-border, var(--vscode-panel-border));
        background: var(--vscode-button-background, color-mix(in srgb, var(--vscode-editor-background) 85%, var(--vscode-editor-foreground) 15%));
        color: var(--vscode-button-foreground, var(--vscode-editor-foreground));
        border-radius: 6px;
        padding: 4px 10px;
        font-size: 12px;
        cursor: pointer;
      }

      .tool-btn:hover {
        background: var(--vscode-button-hoverBackground, color-mix(in srgb, var(--vscode-editor-background) 76%, var(--vscode-editor-foreground) 24%));
      }

      .pill {
        border: 1px solid var(--vscode-panel-border);
        border-radius: 999px;
        padding: 4px 10px;
        font-size: 12px;
        opacity: 0.9;
      }

      .board {
        display: grid;
        gap: 14px;
      }

      .lane {
        border: 1px solid var(--vscode-panel-border);
        border-radius: 10px;
        background: color-mix(in srgb, var(--vscode-editor-background) 92%, var(--vscode-editor-foreground) 8%);
      }

      .lane-head {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 10px 12px;
        border-bottom: 1px solid var(--vscode-panel-border);
        background: color-mix(in srgb, var(--vscode-editor-background) 96%, var(--vscode-editor-foreground) 4%);
        border-top-left-radius: 10px;
        border-top-right-radius: 10px;
      }

      .lane-title {
        font-size: 13px;
        margin: 0;
      }

      .lane-count {
        font-size: 11px;
        border: 1px solid var(--vscode-panel-border);
        border-radius: 999px;
        padding: 2px 8px;
        opacity: 0.85;
      }

      .lane-strip {
        padding: 10px;
        display: flex;
        gap: 10px;
        overflow-x: auto;
      }

      .lane-strip::-webkit-scrollbar {
        height: 8px;
      }

      .lane-strip::-webkit-scrollbar-thumb {
        background: var(--vscode-scrollbarSlider-background);
        border-radius: 8px;
      }

      .cards {
        padding: 10px;
        display: grid;
        gap: 10px;
      }

      .card {
        min-width: 220px;
        border: 1px solid var(--vscode-panel-border);
        border-radius: 8px;
        padding: 10px;
        background: color-mix(in srgb, var(--vscode-editor-background) 80%, var(--vscode-editor-foreground) 20%);
      }

      .card.clickable {
        cursor: pointer;
      }

      .card.clickable:hover {
        border-color: var(--vscode-focusBorder);
      }

      .card.clickable:focus-visible {
        outline: 1px solid var(--vscode-focusBorder);
        outline-offset: 2px;
      }

      .card.chapter {
        border-color: color-mix(in srgb, var(--vscode-terminal-ansiBlue) 40%, var(--vscode-panel-border) 60%);
      }

      .card.scene {
        border-color: color-mix(in srgb, var(--vscode-terminal-ansiMagenta) 40%, var(--vscode-panel-border) 60%);
      }

      .card.scene.missing-meta {
        border-color: var(--vscode-inputValidation-errorBorder, #f14c4c);
        box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--vscode-inputValidation-errorBorder, #f14c4c) 65%, transparent 35%);
      }

      .card-title {
        margin: 0 0 6px 0;
        font-size: 13px;
      }

      .card-meta {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-bottom: 8px;
      }

      .chip {
        font-size: 11px;
        border: 1px solid var(--vscode-panel-border);
        border-radius: 999px;
        padding: 2px 8px;
        opacity: 0.9;
      }

      .chip.warn {
        border-color: var(--vscode-inputValidation-warningBorder, #cca700);
        color: var(--vscode-editorWarning-foreground, #cca700);
      }

      .chip.error {
        border-color: var(--vscode-inputValidation-errorBorder, #f14c4c);
        color: var(--vscode-editorError-foreground, #f14c4c);
      }

      .scene-meta {
        margin: 8px 0 8px;
        display: grid;
        gap: 6px;
        font-size: 11px;
      }

      .scene-meta-row {
        display: grid;
        grid-template-columns: 116px minmax(0, 1fr);
        gap: 6px;
      }

      .scene-meta-label {
        opacity: 0.75;
      }

      .scene-meta-value {
        word-break: break-word;
      }

      .scene-meta-value.empty {
        color: var(--vscode-editorWarning-foreground, #cca700);
        opacity: 0.95;
        font-style: italic;
      }

      .path {
        margin: 0;
        opacity: 0.65;
        font-size: 11px;
        word-break: break-all;
      }

      .empty {
        margin: 0;
        opacity: 0.6;
        font-size: 12px;
        font-style: italic;
      }

      .mono {
        font-family: var(--vscode-editor-font-family);
        font-size: 11px;
      }
    </style>
  </head>
  <body>
    <section class="header">
      <div>
        <h2 class="title">Story Board</h2>
        <p class="subtitle">Лента глав и сцен: кино уже в голове, дедлайны ещё нет.</p>
      </div>
      <div id="stats" class="stats"></div>
    </section>

    <section id="board" class="board"></section>

    <script>
      const vscode = acquireVsCodeApi();
      const cards = ${boardData};

      const chapterCards = cards.filter((card) => card.type === 'chapter');
      const sceneCards = cards.filter((card) => card.type === 'scene');
      const otherCards = cards.filter((card) => card.type !== 'chapter' && card.type !== 'scene');

      function chapterKeyFromPath(filePath) {
        const match = String(filePath).match(/chapters\\/([^\\/]+)\\//);
        return match ? match[1] : 'unassigned';
      }

      function chapterOrderKey(chapterId) {
        const match = String(chapterId).match(/(\\d+)/);
        return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
      }

      const lanesMap = new Map();

      for (const chapter of chapterCards) {
        const key = chapterKeyFromPath(chapter.filePath || chapter.id);
        lanesMap.set(key, { key, chapter, scenes: [] });
      }

      for (const scene of sceneCards) {
        const key = chapterKeyFromPath(scene.filePath || 'unassigned');
        if (!lanesMap.has(key)) {
          lanesMap.set(key, { key, chapter: null, scenes: [] });
        }
        lanesMap.get(key).scenes.push(scene);
      }

      const lanes = Array.from(lanesMap.values()).sort((a, b) => chapterOrderKey(a.key) - chapterOrderKey(b.key));

      const board = document.getElementById("board");
      if (!lanes.length) {
        board.innerHTML = '<p class="empty">Глав и сцен пока нет. Storyboard честно ждёт драму.</p>';
      } else {
        for (const lane of lanes) {
          const chapterCard = lane.chapter
            ? renderCard(lane.chapter, 'chapter')
            : '<article class="card chapter"><h3 class="card-title">Глава не создана</h3><p class="path mono">' + escapeHtml(lane.key) + '</p></article>';

          const sceneCardsHtml = lane.scenes
            .sort((a, b) => String(a.filePath).localeCompare(String(b.filePath), 'ru'))
            .map((scene) => renderCard(scene, 'scene'))
            .join('');

          const laneHtml =
            '<section class="lane">' +
              '<header class="lane-head">' +
                '<h3 class="lane-title">' + escapeHtml(lane.key) + '</h3>' +
                '<span class="lane-count">сцен: ' + lane.scenes.length + '</span>' +
              '</header>' +
              '<div class="lane-strip">' + chapterCard + sceneCardsHtml + '</div>' +
            '</section>';

          board.insertAdjacentHTML('beforeend', laneHtml);
        }
      }

      if (otherCards.length) {
        const otherHtml =
          '<section class="lane">' +
            '<header class="lane-head">' +
              '<h3 class="lane-title">Вне storyboard</h3>' +
              '<span class="lane-count">' + otherCards.length + '</span>' +
            '</header>' +
            '<div class="cards">' + otherCards.map((item) => renderCard(item, '')).join('') + '</div>' +
          '</section>';
        board.insertAdjacentHTML('beforeend', otherHtml);
      }

      const stats = document.getElementById("stats");
      const total = cards.length;
      stats.innerHTML =
        '<span class="pill">Всего: ' + total + '</span>' +
        '<span class="pill">Глав: ' + chapterCards.length + '</span>' +
        '<span class="pill">Сцен: ' + sceneCards.length + '</span>' +
        '<span class="pill">Линий: ' + lanes.length + '</span>' +
        '<span class="pill">Сцен с пропусками: ' + sceneCards.filter((card) => (card.missingSceneFields || []).length > 0).length + '</span>';

      function renderCard(item, kind) {
        const tags = (item.tags || [])
          .slice(0, 4)
          .map((tag) => '<span class="chip">#' + escapeHtml(tag) + '</span>')
          .join('');

        const cls = kind ? 'card ' + kind : 'card';
        const encodedPath = encodeURIComponent(String(item.filePath || ''));
        const canOpen = kind === 'chapter' || kind === 'scene';
        const clickableClass = canOpen ? ' clickable' : '';
        const missing = Array.isArray(item.missingSceneFields) ? item.missingSceneFields : [];
        const missingClass = kind === 'scene' && missing.length ? ' missing-meta' : '';
        const interactiveAttrs = canOpen
          ? ' role="button" tabindex="0" data-file-path="' + encodedPath + '"'
          : '';

        const completenessChip =
          kind === 'scene'
            ? (missing.length
                ? '<span class="chip error">Не заполнено: ' + missing.length + '</span>'
                : '<span class="chip">Служебка: ок</span>')
            : '';

        const sceneMetaHtml = kind === 'scene'
          ? renderSceneMeta(item)
          : '';

        return (
          '<article class="' + cls + clickableClass + missingClass + '"' + interactiveAttrs + '>' +
            '<h3 class="card-title">' + escapeHtml(item.title) + '</h3>' +
            '<div class="card-meta">' +
              '<span class="chip">' + escapeHtml(item.type) + '</span>' +
              '<span class="chip">' + escapeHtml(item.status) + '</span>' +
              completenessChip +
              tags +
            '</div>' +
            sceneMetaHtml +
            '<p class="path mono">' + escapeHtml(item.filePath) + '</p>' +
          '</article>'
        );
      }

      function renderSceneMeta(item) {
        const meta = item.sceneMeta || { what: '', why: '', pov: '', change: '', plotlines: [] };
        const plotlines = Array.isArray(meta.plotlines) ? meta.plotlines.join(', ') : '';
        return (
          '<div class="scene-meta">' +
            sceneMetaRow('Что происходит', meta.what) +
            sceneMetaRow('Зачем нужна', meta.why) +
            sceneMetaRow('Чьими глазами', meta.pov) +
            sceneMetaRow('Что меняется', meta.change) +
            sceneMetaRow('Линии', plotlines) +
          '</div>'
        );
      }

      function sceneMetaRow(label, value) {
        const normalized = String(value || '').trim();
        const valueHtml = normalized
          ? '<span class="scene-meta-value">' + escapeHtml(normalized) + '</span>'
          : '<span class="scene-meta-value empty">не заполнено</span>';

        return (
          '<div class="scene-meta-row">' +
            '<span class="scene-meta-label">' + escapeHtml(label) + ':</span>' +
            valueHtml +
          '</div>'
        );
      }

      function escapeHtml(value) {
        return String(value)
          .replaceAll("&", "&amp;")
          .replaceAll("<", "&lt;")
          .replaceAll(">", "&gt;");
      }

      board.addEventListener('click', (event) => {
        const card = event.target.closest('.card.clickable[data-file-path]');
        if (!card) {
          return;
        }

        const encodedPath = card.getAttribute('data-file-path') || '';
        if (!encodedPath) {
          return;
        }

        vscode.postMessage({ type: 'openEntity', filePath: decodeURIComponent(encodedPath) });
      });

      board.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') {
          return;
        }

        const card = event.target.closest('.card.clickable[data-file-path]');
        if (!card) {
          return;
        }

        event.preventDefault();
        const encodedPath = card.getAttribute('data-file-path') || '';
        if (!encodedPath) {
          return;
        }

        vscode.postMessage({ type: 'openEntity', filePath: decodeURIComponent(encodedPath) });
      });
    </script>
  </body>
</html>`;
  }

  private buildBoardCards(data: string): BoardCard[] {
    try {
      const parsed = JSON.parse(data) as {
        entities?: Array<{
          frontmatter?: Record<string, unknown>;
          body?: string;
          filePath?: string;
        }>;
      };

      const entities = Array.isArray(parsed.entities) ? parsed.entities : [];
      return entities.map((entity) => {
        const frontmatter = entity.frontmatter ?? {};
        const rawStatus = typeof frontmatter.status === "string" ? frontmatter.status : "todo";
        const type = typeof frontmatter.type === "string" ? frontmatter.type : "unknown";
        const sceneMeta = type === "scene" ? extractSceneMeta(frontmatter) : undefined;
        const missingSceneFields = sceneMeta ? getMissingSceneFields(sceneMeta) : [];

        return {
          id: typeof frontmatter.id === "string" ? frontmatter.id : "unknown-id",
          title: typeof frontmatter.title === "string" ? frontmatter.title : "Untitled",
          type,
          status: normalizeStatus(rawStatus),
          filePath: entity.filePath ?? "",
          tags: Array.isArray(frontmatter.tags)
            ? frontmatter.tags.filter((tag): tag is string => typeof tag === "string")
            : [],
          sceneMeta,
          missingSceneFields
        };
      });
    } catch {
      return [];
    }
  }

  private renderGraphHtml(data: string): string {
    const graph = this.buildRelationshipGraphData(data);
    const graphData = JSON.stringify(graph);

    return `<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <style>
      :root {
        color-scheme: light dark;
      }

      body {
        margin: 0;
        padding: 16px;
        font-family: var(--vscode-font-family);
        color: var(--vscode-editor-foreground);
        background: var(--vscode-editor-background);
      }

      .header {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 12px;
      }

      .title {
        margin: 0;
        font-size: 18px;
      }

      .subtitle {
        margin: 4px 0 0 0;
        font-size: 12px;
        opacity: 0.75;
      }

      .stats {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }

      .pill {
        border: 1px solid var(--vscode-panel-border);
        border-radius: 999px;
        padding: 4px 10px;
        font-size: 12px;
        opacity: 0.9;
      }

      .edge-details {
        margin-top: 8px;
        font-size: 12px;
        line-height: 1.4;
        opacity: 0.78;
        max-width: 780px;
      }

      .controls {
        display: inline-flex;
        align-items: center;
        gap: 8px;
      }

      .tool-btn {
        border: 1px solid var(--vscode-panel-border);
        border-radius: 8px;
        background: color-mix(in srgb, var(--vscode-button-background) 22%, var(--vscode-editor-background) 78%);
        color: var(--vscode-editor-foreground);
        min-width: 34px;
        height: 30px;
        padding: 0 10px;
        font: inherit;
        cursor: pointer;
      }

      .tool-btn:hover {
        background: color-mix(in srgb, var(--vscode-button-background) 34%, var(--vscode-editor-background) 66%);
      }

      .panel {
        border: 1px solid var(--vscode-panel-border);
        border-radius: 10px;
        overflow: hidden;
        background:
          radial-gradient(circle at top, color-mix(in srgb, var(--vscode-editor-background) 90%, var(--vscode-editor-foreground) 10%) 0%, transparent 52%),
          color-mix(in srgb, var(--vscode-editor-background) 96%, var(--vscode-editor-foreground) 4%);
      }

      #graph {
        width: 100%;
        height: min(72vh, 860px);
        display: block;
        cursor: grab;
        user-select: none;
      }

      #graph.dragging {
        cursor: grabbing;
      }

      .legend {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        padding: 10px 12px;
        border-top: 1px solid var(--vscode-panel-border);
        background: color-mix(in srgb, var(--vscode-editor-background) 96%, var(--vscode-editor-foreground) 4%);
      }

      .legend-item {
        font-size: 11px;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        border: 1px solid var(--vscode-panel-border);
        border-radius: 999px;
        padding: 2px 8px;
      }

      .dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
      }

      .graph-edge .edge-hitbox {
        cursor: help;
      }

      .graph-edge .edge-line {
        fill: none;
        stroke: var(--vscode-editor-foreground);
        stroke-opacity: 0.3;
        stroke-width: 1.6;
      }

      .graph-edge .edge-label-bg {
        fill: color-mix(in srgb, var(--vscode-editor-background) 90%, transparent 10%);
        stroke: color-mix(in srgb, var(--vscode-panel-border) 78%, transparent 22%);
        stroke-width: 1;
        rx: 8;
        ry: 8;
      }

      .graph-edge .edge-label {
        fill: var(--vscode-editor-foreground);
        font-size: 11px;
        opacity: 0.95;
        pointer-events: none;
      }

      .graph-edge.active .edge-line {
        stroke-opacity: 0.68;
        stroke-width: 2.2;
      }

      .graph-edge.active .edge-label-bg {
        fill: color-mix(in srgb, var(--vscode-editor-background) 80%, var(--vscode-editor-foreground) 20%);
      }

      .graph-node {
        cursor: default;
      }

      .graph-node.clickable {
        cursor: pointer;
      }

      .graph-node .node-shape {
        stroke: color-mix(in srgb, var(--vscode-editor-foreground) 40%, transparent 60%);
        stroke-width: 2.2;
        filter: drop-shadow(0 3px 10px color-mix(in srgb, var(--vscode-editor-background) 65%, transparent 35%));
      }

      .graph-node .node-title {
        fill: color-mix(in srgb, var(--vscode-editor-foreground) 92%, #102030 8%);
        font-size: 13px;
        font-weight: 700;
        text-anchor: middle;
        dominant-baseline: middle;
        pointer-events: none;
      }

      .graph-node.clickable:hover .node-shape {
        stroke: color-mix(in srgb, var(--vscode-editor-foreground) 68%, transparent 32%);
      }

      .graph-node.clickable:hover .node-title {
        fill: var(--vscode-editor-foreground);
      }

      .empty {
        margin: 20px 0 0 0;
        opacity: 0.7;
        font-style: italic;
        font-size: 13px;
      }
    </style>
  </head>
  <body>
    <section class="header">
      <div>
        <h2 class="title">Relationship Graph</h2>
        <p class="subtitle">Связи по полю refs только между персонажами и сюжетными линиями.</p>
        <div id="edgeDetails" class="edge-details">Наведите на дугу, чтобы посмотреть подпись отношения.</div>
      </div>
      <div class="controls">
        <button id="zoomOut" class="tool-btn" type="button" title="Уменьшить">−</button>
        <button id="zoomIn" class="tool-btn" type="button" title="Увеличить">+</button>
        <button id="zoomReset" class="tool-btn" type="button" title="Сбросить масштаб и центр">Сброс</button>
      </div>
      <div id="stats" class="stats"></div>
    </section>

    <section id="emptyState" class="empty" hidden>
      Данных для графа пока нет. Создайте сущности и добавьте refs — будет красиво и местами драматично.
    </section>

    <section id="graphPanel" class="panel">
      <svg id="graph" viewBox="0 0 1200 760" role="img" aria-label="Relationship graph"></svg>
      <div id="legend" class="legend"></div>
    </section>

    <script>
      const vscode = acquireVsCodeApi();
      const graph = ${graphData};

      const svg = document.getElementById('graph');
      const stats = document.getElementById('stats');
      const legend = document.getElementById('legend');
      const panel = document.getElementById('graphPanel');
      const emptyState = document.getElementById('emptyState');
      const edgeDetails = document.getElementById('edgeDetails');
      const zoomInBtn = document.getElementById('zoomIn');
      const zoomOutBtn = document.getElementById('zoomOut');
      const zoomResetBtn = document.getElementById('zoomReset');

      const view = { scale: 1, tx: 0, ty: 0 };
      const zoomMin = 0.35;
      const zoomMax = 2.8;
      let graphBounds = { minX: 0, minY: 0, maxX: 1200, maxY: 760 };
      let viewport = null;
      let isDragging = false;
      let dragStart = { x: 0, y: 0 };
      let movedByDrag = false;

      const typeColors = {
        character: '#4cc2ff',
        plotline: '#f4d35e',
        relationship: '#ff6b8a',
        chapter: '#5e96ff',
        scene: '#bb86ff',
        editorialTask: '#f39c6b',
        checklist: '#7ed957',
        unknown: '#9aa0aa'
      };

      stats.innerHTML =
        '<span class="pill">Узлов: ' + graph.nodes.length + '</span>' +
        '<span class="pill">Рёбер: ' + graph.edges.length + '</span>';

      if (!graph.nodes.length) {
        panel.hidden = true;
        emptyState.hidden = false;
      } else {
        panel.hidden = false;
        emptyState.hidden = true;
        renderLegend();
        renderGraph();
      }

      function renderLegend() {
        const types = Array.from(new Set(graph.nodes.map((node) => node.type))).sort((a, b) => String(a).localeCompare(String(b), 'ru'));
        legend.innerHTML = types
          .map((type) => {
            const color = typeColors[type] || typeColors.unknown;
            return '<span class="legend-item"><span class="dot" style="background:' + color + '"></span>' + escapeHtml(type) + '</span>';
          })
          .join('');
      }

      function renderGraph() {
        const width = 1200;
        const height = 760;
        const nodes = graph.nodes.map((node) => {
          const metrics = measureNode(node);
          return {
            ...node,
            x: 0,
            y: 0,
            vx: 0,
            vy: 0,
            rx: metrics.rx,
            ry: metrics.ry,
            width: metrics.width,
            height: metrics.height
          };
        });

        const nodeById = new Map(nodes.map((node) => [node.id, node]));
        const links = graph.edges
          .map((edge) => ({
            source: nodeById.get(edge.source),
            target: nodeById.get(edge.target),
            label: typeof edge.label === 'string' ? edge.label : ''
          }))
          .filter((edge) => edge.source && edge.target);

        assignEdgeCurvature(links);

        const degreeById = new Map();
        for (const node of nodes) {
          degreeById.set(node.id, 0);
        }
        for (const link of links) {
          degreeById.set(link.source.id, (degreeById.get(link.source.id) || 0) + 1);
          degreeById.set(link.target.id, (degreeById.get(link.target.id) || 0) + 1);
        }

        const adjacency = new Map();
        for (const node of nodes) {
          adjacency.set(node.id, new Set());
        }
        for (const link of links) {
          adjacency.get(link.source.id).add(link.target.id);
          adjacency.get(link.target.id).add(link.source.id);
        }

        const components = [];
        const seen = new Set();
        for (const node of nodes) {
          if (seen.has(node.id)) {
            continue;
          }
          const stack = [node.id];
          const compIds = [];
          seen.add(node.id);
          while (stack.length) {
            const current = stack.pop();
            compIds.push(current);
            const neighbors = adjacency.get(current) || new Set();
            for (const next of neighbors) {
              if (!seen.has(next)) {
                seen.add(next);
                stack.push(next);
              }
            }
          }
          components.push(compIds);
        }

        components.sort((a, b) => b.length - a.length);
        const cols = Math.max(1, Math.ceil(Math.sqrt(components.length)));
        const rows = Math.max(1, Math.ceil(components.length / cols));
        const cellW = width / cols;
        const cellH = height / rows;

        components.forEach((compIds, compIndex) => {
          const col = compIndex % cols;
          const row = Math.floor(compIndex / cols);
          const cx = cellW * (col + 0.5);
          const cy = cellH * (row + 0.5);

          const compNodes = compIds
            .map((id) => nodeById.get(id))
            .filter(Boolean)
            .sort((a, b) => (degreeById.get(b.id) || 0) - (degreeById.get(a.id) || 0));

          if (compNodes.length === 1) {
            compNodes[0].x = cx;
            compNodes[0].y = cy;
            return;
          }

          const majorNode = compNodes[0];
          const outerNodes = compNodes.length > 4 ? compNodes.slice(1) : compNodes;
          if (compNodes.length > 4) {
            majorNode.x = cx;
            majorNode.y = cy;
          }

          const radiusX = Math.max(120, cellW * (compNodes.length > 4 ? 0.28 : 0.2));
          const radiusY = Math.max(92, cellH * (compNodes.length > 4 ? 0.26 : 0.18));
          outerNodes.forEach((node, index) => {
            const angle = (-Math.PI / 2) + (index / outerNodes.length) * Math.PI * 2;
            node.x = cx + Math.cos(angle) * radiusX;
            node.y = cy + Math.sin(angle) * radiusY;
          });
        });

        const repulsion = 13500;
        const spring = 0.01;
        const damping = 0.82;
        const desiredLength = 190;
        const centering = 0.0024;
        const centerX = width / 2;
        const centerY = height / 2;

        for (let step = 0; step < 420; step += 1) {
          for (let i = 0; i < nodes.length; i += 1) {
            const a = nodes[i];
            for (let j = i + 1; j < nodes.length; j += 1) {
              const b = nodes[j];
              let dx = a.x - b.x;
              let dy = a.y - b.y;
              const distSq = Math.max(dx * dx + dy * dy, 0.01);
              const force = repulsion / distSq;
              const dist = Math.sqrt(distSq);
              dx /= dist;
              dy /= dist;

              a.vx += dx * force;
              a.vy += dy * force;
              b.vx -= dx * force;
              b.vy -= dy * force;

              const collisionDist = Math.max(a.rx + b.rx + 34, a.ry + b.ry + 30);
              if (dist < collisionDist) {
                const push = (collisionDist - dist) * 0.06;
                a.vx += dx * push;
                a.vy += dy * push;
                b.vx -= dx * push;
                b.vy -= dy * push;
              }
            }
          }

          for (const link of links) {
            const dx = link.target.x - link.source.x;
            const dy = link.target.y - link.source.y;
            const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 0.001);
            const sourceDegree = degreeById.get(link.source.id) || 0;
            const targetDegree = degreeById.get(link.target.id) || 0;
            const adaptiveLength = desiredLength + Math.min(sourceDegree + targetDegree, 8) * 10;
            const stretch = dist - adaptiveLength;
            const force = stretch * spring;
            const nx = dx / dist;
            const ny = dy / dist;

            link.source.vx += nx * force;
            link.source.vy += ny * force;
            link.target.vx -= nx * force;
            link.target.vy -= ny * force;
          }

          for (const node of nodes) {
            node.vx += (centerX - node.x) * centering;
            node.vy += (centerY - node.y) * centering;

            node.vx *= damping;
            node.vy *= damping;
            node.x += node.vx;
            node.y += node.vy;

            node.x = Math.max(node.rx + 30, Math.min(width - node.rx - 30, node.x));
            node.y = Math.max(node.ry + 30, Math.min(height - node.ry - 30, node.y));
          }
        }

        const linkGeometries = links.map((link, index) => buildEdgeGeometry(link, index));
        graphBounds = collectGraphBounds(nodes, linkGeometries, width, height);

        const markers =
          '<defs>' +
            '<marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">' +
              '<path d="M 0 0 L 10 5 L 0 10 z" fill="var(--vscode-editor-foreground)" opacity="0.45"></path>' +
            '</marker>' +
          '</defs>';

        const edgesMarkup = linkGeometries
          .map((edge) => {
            const displayLabel = shorten(edge.label || '', 28);
            const encodedLabel = encodeURIComponent(edge.label || '');
            const labelWidth = estimateLabelWidth(displayLabel);
            const hasLabel = Boolean(displayLabel);
            return (
              '<g class="graph-edge" data-edge-label="' + encodedLabel + '">' +
                '<path class="edge-hitbox" d="' + edge.path + '" stroke="transparent" stroke-width="20" fill="none"></path>' +
                '<path class="edge-line" d="' + edge.path + '" marker-end="url(#arrow)"></path>' +
                (hasLabel
                  ? '<rect class="edge-label-bg" x="' + (edge.labelX - labelWidth / 2).toFixed(1) + '" y="' + (edge.labelY - 11).toFixed(1) + '" width="' + labelWidth.toFixed(1) + '" height="22"></rect>' +
                    '<text class="edge-label" x="' + edge.labelX.toFixed(1) + '" y="' + (edge.labelY + 3).toFixed(1) + '" text-anchor="middle">' + escapeHtml(displayLabel) + '</text>'
                  : '') +
                (edge.label ? '<title>' + escapeHtml(edge.label) + '</title>' : '') +
              '</g>'
            );
          })
          .join('');

        const nodesMarkup = nodes
          .map((node) => {
            const color = typeColors[node.type] || typeColors.unknown;
            const encodedPath = encodeURIComponent(String(node.filePath || ''));
            const canOpen = Boolean(node.filePath);
            const attrs = canOpen ? ' data-file-path="' + encodedPath + '" class="graph-node clickable"' : ' class="graph-node"';
            return (
              '<g transform="translate(' + node.x.toFixed(1) + ',' + node.y.toFixed(1) + ')"' + attrs + '>' +
                '<ellipse class="node-shape" rx="' + node.rx.toFixed(1) + '" ry="' + node.ry.toFixed(1) + '" fill="' + color + '"></ellipse>' +
                '<title>' + escapeHtml(node.title + ' (' + node.type + ')') + '</title>' +
                '<text class="node-title" x="0" y="1">' + escapeHtml(shorten(node.title, 24)) + '</text>' +
              '</g>'
            );
          })
          .join('');

        svg.innerHTML = markers + '<g id="viewport">' + edgesMarkup + nodesMarkup + '</g>';
        viewport = svg.querySelector('#viewport');
        fitGraphToView();
      }

      function fitGraphToView() {
        const width = 1200;
        const height = 760;
        const padding = 36;
        const contentW = Math.max(graphBounds.maxX - graphBounds.minX, 1);
        const contentH = Math.max(graphBounds.maxY - graphBounds.minY, 1);
        const scaleX = (width - padding * 2) / contentW;
        const scaleY = (height - padding * 2) / contentH;

        view.scale = clamp(Math.min(scaleX, scaleY), zoomMin, zoomMax);
        const centerContentX = (graphBounds.minX + graphBounds.maxX) / 2;
        const centerContentY = (graphBounds.minY + graphBounds.maxY) / 2;
        view.tx = width / 2 - centerContentX * view.scale;
        view.ty = height / 2 - centerContentY * view.scale;
        applyTransform();
      }

      function applyTransform() {
        if (!viewport) {
          return;
        }
        viewport.setAttribute('transform', 'translate(' + view.tx.toFixed(2) + ' ' + view.ty.toFixed(2) + ') scale(' + view.scale.toFixed(4) + ')');
      }

      function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
      }

      function measureNode(node) {
        const title = String(node.title || '');
        const length = Math.max(4, title.length);
        const width = clamp(42 + length * 8.5, 92, 220);
        const height = 54;
        return {
          width,
          height,
          rx: width / 2,
          ry: height / 2
        };
      }

      function assignEdgeCurvature(links) {
        const groups = new Map();
        links.forEach((link) => {
          const pairKey = [link.source.id, link.target.id].sort((a, b) => a.localeCompare(b, 'ru')).join('::');
          if (!groups.has(pairKey)) {
            groups.set(pairKey, []);
          }
          groups.get(pairKey).push(link);
        });

        groups.forEach((group) => {
          group.sort((left, right) => {
            const leftKey = left.source.id + '->' + left.target.id;
            const rightKey = right.source.id + '->' + right.target.id;
            return leftKey.localeCompare(rightKey, 'ru');
          });

          if (group.length === 1) {
            group[0].curvature = 0.14;
            return;
          }

          const middle = (group.length - 1) / 2;
          group.forEach((link, index) => {
            const offset = (index - middle) * 0.26;
            link.curvature = Math.abs(offset) < 0.01 ? 0.18 : offset;
          });
        });
      }

      function buildEdgeGeometry(link, index) {
        const dx = link.target.x - link.source.x;
        const dy = link.target.y - link.source.y;
        const distance = Math.max(Math.sqrt(dx * dx + dy * dy), 0.001);
        const nx = dx / distance;
        const ny = dy / distance;
        const perpX = -ny;
        const perpY = nx;
        const curveOffset = clamp(distance * Math.abs(link.curvature || 0.14), 34, 150) * Math.sign(link.curvature || 1);
        const midX = (link.source.x + link.target.x) / 2;
        const midY = (link.source.y + link.target.y) / 2;
        const controlX = midX + perpX * curveOffset;
        const controlY = midY + perpY * curveOffset;

        const sourceAnchor = ellipseAnchor(link.source, controlX, controlY);
        const targetAnchor = ellipseAnchor(link.target, controlX, controlY);
        const labelPoint = quadraticPoint(sourceAnchor.x, sourceAnchor.y, controlX, controlY, targetAnchor.x, targetAnchor.y, 0.5);
        const labelLift = 10 + Math.min(Math.abs(curveOffset) * 0.08, 10);

        return {
          id: 'edge-' + index,
          label: link.label || '',
          path:
            'M ' + sourceAnchor.x.toFixed(1) + ' ' + sourceAnchor.y.toFixed(1) +
            ' Q ' + controlX.toFixed(1) + ' ' + controlY.toFixed(1) +
            ' ' + targetAnchor.x.toFixed(1) + ' ' + targetAnchor.y.toFixed(1),
          controlX,
          controlY,
          labelX: labelPoint.x,
          labelY: labelPoint.y - Math.sign(curveOffset || 1) * labelLift,
          points: [sourceAnchor, { x: controlX, y: controlY }, targetAnchor]
        };
      }

      function collectGraphBounds(nodes, edges, width, height) {
        const initial = {
          minX: Number.POSITIVE_INFINITY,
          minY: Number.POSITIVE_INFINITY,
          maxX: Number.NEGATIVE_INFINITY,
          maxY: Number.NEGATIVE_INFINITY
        };

        const nodeBounds = nodes.reduce((acc, node) => ({
          minX: Math.min(acc.minX, node.x - node.rx - 14),
          minY: Math.min(acc.minY, node.y - node.ry - 14),
          maxX: Math.max(acc.maxX, node.x + node.rx + 14),
          maxY: Math.max(acc.maxY, node.y + node.ry + 14)
        }), initial);

        const fullBounds = edges.reduce((acc, edge) => {
          const labelPad = Math.max(26, estimateLabelWidth(shorten(edge.label || '', 28)) / 2 + 8);
          return edge.points.reduce((nextAcc, point) => ({
            minX: Math.min(nextAcc.minX, point.x - labelPad),
            minY: Math.min(nextAcc.minY, point.y - 24),
            maxX: Math.max(nextAcc.maxX, point.x + labelPad),
            maxY: Math.max(nextAcc.maxY, point.y + 24)
          }), {
            minX: Math.min(acc.minX, edge.labelX - labelPad),
            minY: Math.min(acc.minY, edge.labelY - 20),
            maxX: Math.max(acc.maxX, edge.labelX + labelPad),
            maxY: Math.max(acc.maxY, edge.labelY + 20)
          });
        }, nodeBounds);

        if (!Number.isFinite(fullBounds.minX)) {
          return { minX: 0, minY: 0, maxX: width, maxY: height };
        }

        return fullBounds;
      }

      function ellipseAnchor(node, towardX, towardY) {
        const dirX = towardX - node.x;
        const dirY = towardY - node.y;
        const length = Math.max(Math.sqrt(dirX * dirX + dirY * dirY), 0.001);
        const ux = dirX / length;
        const uy = dirY / length;
        const scale = 1 / Math.sqrt((ux * ux) / (node.rx * node.rx) + (uy * uy) / (node.ry * node.ry));
        return {
          x: node.x + ux * scale,
          y: node.y + uy * scale
        };
      }

      function quadraticPoint(x1, y1, cx, cy, x2, y2, t) {
        const mt = 1 - t;
        return {
          x: mt * mt * x1 + 2 * mt * t * cx + t * t * x2,
          y: mt * mt * y1 + 2 * mt * t * cy + t * t * y2
        };
      }

      function estimateLabelWidth(text) {
        const length = String(text || '').length;
        return Math.max(42, 18 + length * 6.4);
      }

      function zoomAt(factor, clientX, clientY) {
        if (!viewport) {
          return;
        }
        const ctm = svg.getScreenCTM();
        if (!ctm) {
          return;
        }

        const pt = svg.createSVGPoint();
        pt.x = clientX;
        pt.y = clientY;
        const svgPoint = pt.matrixTransform(ctm.inverse());

        const worldX = (svgPoint.x - view.tx) / view.scale;
        const worldY = (svgPoint.y - view.ty) / view.scale;
        const nextScale = clamp(view.scale * factor, zoomMin, zoomMax);
        if (Math.abs(nextScale - view.scale) < 0.0001) {
          return;
        }

        view.scale = nextScale;
        view.tx = svgPoint.x - worldX * view.scale;
        view.ty = svgPoint.y - worldY * view.scale;
        applyTransform();
      }

      zoomInBtn?.addEventListener('click', () => {
        const rect = svg.getBoundingClientRect();
        zoomAt(1.2, rect.left + rect.width / 2, rect.top + rect.height / 2);
      });

      zoomOutBtn?.addEventListener('click', () => {
        const rect = svg.getBoundingClientRect();
        zoomAt(1 / 1.2, rect.left + rect.width / 2, rect.top + rect.height / 2);
      });

      zoomResetBtn?.addEventListener('click', () => {
        fitGraphToView();
      });

      svg.addEventListener('wheel', (event) => {
        event.preventDefault();
        const factor = event.deltaY < 0 ? 1.1 : 1 / 1.1;
        zoomAt(factor, event.clientX, event.clientY);
      }, { passive: false });

      svg.addEventListener('mousedown', (event) => {
        if (event.button !== 0) {
          return;
        }
        isDragging = true;
        movedByDrag = false;
        dragStart = { x: event.clientX, y: event.clientY };
        svg.classList.add('dragging');
      });

      window.addEventListener('mousemove', (event) => {
        if (!isDragging) {
          return;
        }
        const dx = event.clientX - dragStart.x;
        const dy = event.clientY - dragStart.y;
        if (Math.abs(dx) + Math.abs(dy) > 2) {
          movedByDrag = true;
        }
        dragStart = { x: event.clientX, y: event.clientY };
        view.tx += dx;
        view.ty += dy;
        applyTransform();
      });

      window.addEventListener('mouseup', () => {
        isDragging = false;
        svg.classList.remove('dragging');
      });

      svg.addEventListener('click', (event) => {
        if (movedByDrag) {
          movedByDrag = false;
          return;
        }
        const group = event.target.closest('g.graph-node.clickable[data-file-path]');
        if (!group) {
          return;
        }

        const encodedPath = group.getAttribute('data-file-path') || '';
        if (!encodedPath) {
          return;
        }

        vscode.postMessage({ type: 'openEntity', filePath: decodeURIComponent(encodedPath) });
      });

      svg.addEventListener('mousemove', (event) => {
        const edge = event.target.closest('g.graph-edge[data-edge-label]');
        const allEdges = svg.querySelectorAll('g.graph-edge.active');
        allEdges.forEach((item) => item.classList.remove('active'));

        if (!edge) {
          if (edgeDetails) {
            edgeDetails.textContent = 'Наведите на дугу, чтобы посмотреть подпись отношения.';
          }
          return;
        }

        edge.classList.add('active');
        if (edgeDetails) {
          const encoded = edge.getAttribute('data-edge-label') || '';
          edgeDetails.textContent = encoded ? decodeURIComponent(encoded) : 'Подпись отношения недоступна.';
        }
      });

      svg.addEventListener('mouseleave', () => {
        const allEdges = svg.querySelectorAll('g.graph-edge.active');
        allEdges.forEach((item) => item.classList.remove('active'));
        if (edgeDetails) {
          edgeDetails.textContent = 'Наведите на дугу, чтобы посмотреть подпись отношения.';
        }
      });

      function shorten(value, max) {
        const text = String(value || '');
        if (text.length <= max) {
          return text;
        }
        return text.slice(0, max - 1) + '…';
      }

      function escapeHtml(value) {
        return String(value)
          .replaceAll('&', '&amp;')
          .replaceAll('<', '&lt;')
          .replaceAll('>', '&gt;');
      }
    </script>
  </body>
</html>`;
  }

  private buildRelationshipGraphData(data: string): { nodes: GraphNode[]; edges: GraphEdge[] } {
    return buildRelationshipGraphData(data);
  }
}

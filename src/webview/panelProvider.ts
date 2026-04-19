import * as path from "node:path";
import * as vscode from "vscode";
import { ProjectService } from "../domain/projectService";

type BoardCard = {
  id: string;
  title: string;
  type: string;
  status: string;
  filePath: string;
  tags: string[];
  sceneMeta?: SceneMeta;
  missingSceneFields?: string[];
};

type SceneMeta = {
  what: string;
  why: string;
  pov: string;
  change: string;
  plotlines: string[];
};

type GraphNode = {
  id: string;
  title: string;
  type: string;
  status: string;
  filePath: string;
  refs: string[];
};

type GraphEdge = {
  source: string;
  target: string;
};

export class PanelProvider {
  constructor(private readonly projectService: ProjectService) {}

  async openBoard(): Promise<void> {
    const panel = vscode.window.createWebviewPanel(
      "bookProjectBoard",
      "Story Board",
      vscode.ViewColumn.One,
      { enableScripts: true }
    );

    panel.webview.onDidReceiveMessage(async (message: { type?: string; filePath?: string }) => {
      if (message.type !== "openEntity" || typeof message.filePath !== "string" || !message.filePath.trim()) {
        return;
      }

      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        vscode.window.showWarningMessage("Workspace folder not found.");
        return;
      }

      const filePath = message.filePath.trim();
      const targetUri = path.isAbsolute(filePath)
        ? vscode.Uri.file(filePath)
        : vscode.Uri.joinPath(workspaceFolder.uri, filePath);

      try {
        const doc = await vscode.workspace.openTextDocument(targetUri);
        await vscode.window.showTextDocument(doc, { preview: false });
      } catch {
        vscode.window.showWarningMessage(`Cannot open file: ${filePath}`);
      }
    });

    const data = await this.projectService.getIndexJson();
    panel.webview.html = this.renderBoardHtml(data);
  }

  async openRelationshipGraph(): Promise<void> {
    const panel = vscode.window.createWebviewPanel(
      "bookProjectGraph",
      "Relationship Graph",
      vscode.ViewColumn.Beside,
      { enableScripts: true }
    );

    panel.webview.onDidReceiveMessage(async (message: { type?: string; filePath?: string }) => {
      if (message.type !== "openEntity" || typeof message.filePath !== "string" || !message.filePath.trim()) {
        return;
      }

      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        vscode.window.showWarningMessage("Workspace folder not found.");
        return;
      }

      const filePath = message.filePath.trim();
      const targetUri = path.isAbsolute(filePath)
        ? vscode.Uri.file(filePath)
        : vscode.Uri.joinPath(workspaceFolder.uri, filePath);

      try {
        const doc = await vscode.workspace.openTextDocument(targetUri);
        await vscode.window.showTextDocument(doc, { preview: false });
      } catch {
        vscode.window.showWarningMessage(`Cannot open file: ${filePath}`);
      }
    });

    const data = await this.projectService.getIndexJson();
    panel.webview.html = this.renderGraphHtml(data);
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

      .panel {
        border: 1px solid var(--vscode-panel-border);
        border-radius: 10px;
        overflow: hidden;
        background: color-mix(in srgb, var(--vscode-editor-background) 94%, var(--vscode-editor-foreground) 6%);
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
        <p class="subtitle">Связи сущностей по полю refs: персонажи, линии, главы, сцены и всё редакторское веселье.</p>
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
        const nodes = graph.nodes.map((node) => ({ ...node, x: 0, y: 0, vx: 0, vy: 0 }));

        const nodeById = new Map(nodes.map((node) => [node.id, node]));
        const links = graph.edges
          .map((edge) => ({
            source: nodeById.get(edge.source),
            target: nodeById.get(edge.target)
          }))
          .filter((edge) => edge.source && edge.target);

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

          const ringStep = Math.max(28, Math.min(cellW, cellH) * 0.07);
          const ringBase = Math.max(12, Math.min(cellW, cellH) * 0.12);
          compNodes.forEach((node, index) => {
            const ring = Math.floor(Math.sqrt(index));
            const ringCount = Math.max(1, 6 * ring);
            const posInRing = ring === 0 ? 0 : index - ring * ring;
            const angle = ring === 0 ? 0 : (posInRing / ringCount) * Math.PI * 2;
            const r = ring === 0 ? 0 : ringBase + ring * ringStep;
            node.x = cx + Math.cos(angle) * r;
            node.y = cy + Math.sin(angle) * r;
          });
        });

        const repulsion = 5600;
        const spring = 0.008;
        const damping = 0.84;
        const desiredLength = 165;
        const collisionDist = 52;
        const centering = 0.003;
        const centerX = width / 2;
        const centerY = height / 2;

        for (let step = 0; step < 380; step += 1) {
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

              if (dist < collisionDist) {
                const push = (collisionDist - dist) * 0.05;
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
            const adaptiveLength = desiredLength + Math.min(sourceDegree + targetDegree, 8) * 8;
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

            node.x = Math.max(26, Math.min(width - 26, node.x));
            node.y = Math.max(26, Math.min(height - 26, node.y));
          }
        }

        graphBounds = nodes.reduce(
          (acc, node) => ({
            minX: Math.min(acc.minX, node.x - 18),
            minY: Math.min(acc.minY, node.y - 18),
            maxX: Math.max(acc.maxX, node.x + 120),
            maxY: Math.max(acc.maxY, node.y + 18)
          }),
          { minX: Number.POSITIVE_INFINITY, minY: Number.POSITIVE_INFINITY, maxX: Number.NEGATIVE_INFINITY, maxY: Number.NEGATIVE_INFINITY }
        );

        if (!Number.isFinite(graphBounds.minX)) {
          graphBounds = { minX: 0, minY: 0, maxX: width, maxY: height };
        }

        const markers =
          '<defs>' +
            '<marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">' +
              '<path d="M 0 0 L 10 5 L 0 10 z" fill="var(--vscode-editor-foreground)" opacity="0.45"></path>' +
            '</marker>' +
          '</defs>';

        const edgesMarkup = links
          .map((link) => {
            return (
              '<line x1="' + link.source.x.toFixed(1) + '" y1="' + link.source.y.toFixed(1) + '" x2="' + link.target.x.toFixed(1) + '" y2="' + link.target.y.toFixed(1) + '" ' +
              'stroke="var(--vscode-editor-foreground)" stroke-opacity="0.25" stroke-width="1.2" marker-end="url(#arrow)"></line>'
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
                '<circle r="9" fill="' + color + '" stroke="var(--vscode-editor-background)" stroke-width="2"></circle>' +
                '<title>' + escapeHtml(node.title + ' (' + node.type + ')') + '</title>' +
                '<text x="12" y="4" font-size="11" fill="var(--vscode-editor-foreground)">' + escapeHtml(shorten(node.title, 24)) + '</text>' +
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
    try {
      const parsed = JSON.parse(data) as {
        entities?: Array<{
          frontmatter?: Record<string, unknown>;
          filePath?: string;
        }>;
      };

      const entities = Array.isArray(parsed.entities) ? parsed.entities : [];
      const nodes: GraphNode[] = entities.map((entity) => {
        const frontmatter = entity.frontmatter ?? {};
        const rawStatus = typeof frontmatter.status === "string" ? frontmatter.status : "todo";

        const refs = Array.isArray(frontmatter.refs)
          ? frontmatter.refs.filter((ref): ref is string => typeof ref === "string")
          : [];

        return {
          id: typeof frontmatter.id === "string" ? frontmatter.id : "unknown-id",
          title: typeof frontmatter.title === "string" ? frontmatter.title : "Untitled",
          type: typeof frontmatter.type === "string" ? frontmatter.type : "unknown",
          status: normalizeStatus(rawStatus),
          filePath: entity.filePath ?? "",
          refs
        };
      });

      const knownIds = new Set(nodes.map((node) => node.id));
      const edgeDedup = new Set<string>();
      const edges: GraphEdge[] = [];

      for (const node of nodes) {
        for (const ref of node.refs) {
          if (!knownIds.has(ref)) {
            continue;
          }

          const key = `${node.id}->${ref}`;
          if (edgeDedup.has(key)) {
            continue;
          }

          edgeDedup.add(key);
          edges.push({ source: node.id, target: ref });
        }
      }

      return { nodes, edges };
    } catch {
      return { nodes: [], edges: [] };
    }
  }
}

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function normalizeStatus(status: string): string {
  const normalized = status.trim().toLowerCase();
  if (["todo", "to-do", "backlog", "planned"].includes(normalized)) {
    return "todo";
  }
  if (["in-progress", "inprogress", "doing", "wip"].includes(normalized)) {
    return "in-progress";
  }
  if (["review", "qa", "ready-for-review"].includes(normalized)) {
    return "review";
  }
  if (["done", "completed", "closed"].includes(normalized)) {
    return "done";
  }
  return "todo";
}

function extractSceneMeta(frontmatter: Record<string, unknown>): SceneMeta {
  return {
    what: readString(frontmatter.sceneWhat),
    why: readString(frontmatter.sceneWhy),
    pov: readString(frontmatter.scenePov),
    change: readString(frontmatter.sceneChange),
    plotlines: readStringArray(frontmatter.scenePlotlines)
  };
}

function getMissingSceneFields(sceneMeta: SceneMeta): string[] {
  const missing: string[] = [];
  if (!sceneMeta.what.trim()) {
    missing.push("what");
  }
  if (!sceneMeta.why.trim()) {
    missing.push("why");
  }
  if (!sceneMeta.pov.trim()) {
    missing.push("pov");
  }
  if (!sceneMeta.change.trim()) {
    missing.push("change");
  }
  if (!sceneMeta.plotlines.length) {
    missing.push("plotlines");
  }
  return missing;
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

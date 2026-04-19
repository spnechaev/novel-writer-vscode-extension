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
        '<span class="pill">Линий: ' + lanes.length + '</span>';

      function renderCard(item, kind) {
        const tags = (item.tags || [])
          .slice(0, 4)
          .map((tag) => '<span class="chip">#' + escapeHtml(tag) + '</span>')
          .join('');

        const cls = kind ? 'card ' + kind : 'card';
        const encodedPath = encodeURIComponent(String(item.filePath || ''));
        const canOpen = kind === 'chapter' || kind === 'scene';
        const clickableClass = canOpen ? ' clickable' : '';
        const interactiveAttrs = canOpen
          ? ' role="button" tabindex="0" data-file-path="' + encodedPath + '"'
          : '';

        return (
          '<article class="' + cls + clickableClass + '"' + interactiveAttrs + '>' +
            '<h3 class="card-title">' + escapeHtml(item.title) + '</h3>' +
            '<div class="card-meta">' +
              '<span class="chip">' + escapeHtml(item.type) + '</span>' +
              '<span class="chip">' + escapeHtml(item.status) + '</span>' +
              tags +
            '</div>' +
            '<p class="path mono">' + escapeHtml(item.filePath) + '</p>' +
          '</article>'
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
          filePath?: string;
        }>;
      };

      const entities = Array.isArray(parsed.entities) ? parsed.entities : [];
      return entities.map((entity) => {
        const frontmatter = entity.frontmatter ?? {};
        const rawStatus = typeof frontmatter.status === "string" ? frontmatter.status : "todo";

        return {
          id: typeof frontmatter.id === "string" ? frontmatter.id : "unknown-id",
          title: typeof frontmatter.title === "string" ? frontmatter.title : "Untitled",
          type: typeof frontmatter.type === "string" ? frontmatter.type : "unknown",
          status: normalizeStatus(rawStatus),
          filePath: entity.filePath ?? "",
          tags: Array.isArray(frontmatter.tags)
            ? frontmatter.tags.filter((tag): tag is string => typeof tag === "string")
            : []
        };
      });
    } catch {
      return [];
    }
  }

  private renderGraphHtml(data: string): string {
    return `<!doctype html>
<html>
  <body>
    <h2>Relationship Graph</h2>
    <p>MVP graph source data (rendering scaffold).</p>
    <pre>${escapeHtml(data)}</pre>
  </body>
</html>`;
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

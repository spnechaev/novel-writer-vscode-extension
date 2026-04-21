import type { BoardCard } from "../boardTypes";
import { normalizeStatus } from "../../shared/html";
import { extractSceneMeta, getMissingSceneFields } from "../../shared/sceneMeta";

export function renderBoardHtml(data: string, stylesheetUri = ""): string {
  const boardCards = buildBoardCards(data);
  const boardData = JSON.stringify(boardCards);

  return `<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    ${stylesheetUri ? `<link rel="stylesheet" href="${stylesheetUri}" />` : ""}
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
        const match = String(filePath).match(/chapters\/([^\/]+)\//);
        return match ? match[1] : 'unassigned';
      }

      function chapterOrderKey(chapterId) {
        const match = String(chapterId).match(/(\d+)/);
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

function buildBoardCards(data: string): BoardCard[] {
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

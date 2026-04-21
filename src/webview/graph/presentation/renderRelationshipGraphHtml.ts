export interface RelationshipGraphNode {
  id: string;
  label: string;
  type: string;
  filePath?: string;
}

export interface RelationshipGraphEdge {
  source: string;
  target: string;
  label?: string;
}

export interface RelationshipGraphData {
  nodes: RelationshipGraphNode[];
  edges: RelationshipGraphEdge[];
}

export function renderRelationshipGraphHtml(
  graph: RelationshipGraphData,
  stylesheetUri = "",
  cytoscapeScriptUri = ""
): string {
  const graphData = JSON.stringify(graph);

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
        <h2 class="title">Relationship Graph</h2>
        <p class="subtitle">Персонажи сцеплены своими заметками, а раскладывает этот клубок уже библиотека, не ручная акробатика на SVG.</p>
      </div>
      <div id="stats" class="stats"></div>
    </section>

    <section class="panel">
      <div id="graph"></div>
      <div class="legend">
        <span class="legend-item"><span class="dot" style="background:#7c3aed"></span>персонаж</span>
        <span class="legend-item"><span class="dot" style="background:#0ea5e9"></span>линия</span>
      </div>
    </section>

    <p id="edge-details" class="edge-details">Выберите связь или узел, чтобы увидеть подпись и при необходимости открыть исходный файл.</p>
    <p id="empty" class="empty" hidden>Связи не найдены. Значит, драматургия пока держится на честном слове.</p>

    ${cytoscapeScriptUri ? `<script src="${cytoscapeScriptUri}"></script>` : ""}
    <script>
      const vscode = acquireVsCodeApi();
      const graph = ${graphData};
      const stats = document.getElementById('stats');
      const edgeDetails = document.getElementById('edge-details');
      const empty = document.getElementById('empty');
      const graphElement = document.getElementById('graph');

      stats.innerHTML =
        '<span class="pill">Узлов: ' + graph.nodes.length + '</span>' +
        '<span class="pill">Связей: ' + graph.edges.length + '</span>' +
        '<span class="pill">Персонажей: ' + graph.nodes.filter((node) => node.type === 'character').length + '</span>' +
        '<span class="pill">Линий: ' + graph.nodes.filter((node) => node.type === 'plotline').length + '</span>';

      if (!graph.nodes.length || typeof cytoscape !== 'function') {
        empty.hidden = false;
        graphElement.style.display = 'none';
      } else {
        const nodeElements = graph.nodes.map((node) => ({
          group: 'nodes',
          data: {
            id: node.id,
            label: node.label,
            type: node.type,
            filePath: node.filePath || ''
          }
        }));

        const edgeElements = graph.edges.map((edge, index) => ({
          group: 'edges',
          data: {
            id: 'edge-' + index,
            source: edge.source,
            target: edge.target,
            label: edge.label || ''
          }
        }));

        const cy = cytoscape({
          container: graphElement,
          elements: [...nodeElements, ...edgeElements],
          layout: {
            name: 'cose',
            animate: false,
            fit: true,
            padding: 36,
            nodeRepulsion: 280000,
            idealEdgeLength: 160
          },
          style: [
            {
              selector: 'node',
              style: {
                'background-color': 'data(color)',
                'label': 'data(label)',
                'text-wrap': 'wrap',
                'text-max-width': 110,
                'text-valign': 'center',
                'text-halign': 'center',
                'color': '#f8fafc',
                'font-size': 12,
                'font-weight': 700,
                'text-outline-width': 0,
                'width': 56,
                'height': 56,
                'border-width': 2,
                'border-color': '#ffffff22'
              }
            },
            {
              selector: 'node[type = "character"]',
              style: {
                'background-color': '#7c3aed'
              }
            },
            {
              selector: 'node[type = "plotline"]',
              style: {
                'background-color': '#0ea5e9',
                'shape': 'round-rectangle',
                'width': 72,
                'height': 44
              }
            },
            {
              selector: 'edge',
              style: {
                'width': 2,
                'line-color': '#94a3b8aa',
                'target-arrow-color': '#94a3b8aa',
                'target-arrow-shape': 'triangle',
                'curve-style': 'bezier',
                'label': 'data(label)',
                'font-size': 10,
                'text-background-opacity': 1,
                'text-background-color': '#0f172acc',
                'text-background-padding': 4,
                'color': '#e2e8f0',
                'text-wrap': 'wrap',
                'text-max-width': 200
              }
            },
            {
              selector: ':selected',
              style: {
                'border-color': '#f8fafc',
                'border-width': 3,
                'line-color': '#f8fafc',
                'target-arrow-color': '#f8fafc'
              }
            }
          ]
        });

        cy.on('tap', 'node', (event) => {
          const node = event.target.data();
          edgeDetails.textContent = node.label + ' • ' + (node.type === 'plotline' ? 'сюжетная линия' : 'персонаж');
          if (node.filePath) {
            vscode.postMessage({ type: 'openEntity', filePath: node.filePath });
          }
        });

        cy.on('tap', 'edge', (event) => {
          const edge = event.target.data();
          edgeDetails.textContent = edge.label || (edge.source + ' → ' + edge.target);
        });

        cy.on('tap', (event) => {
          if (event.target === cy) {
            edgeDetails.textContent = 'Выберите связь или узел, чтобы увидеть подпись и при необходимости открыть исходный файл.';
          }
        });
      }
    </script>
  </body>
</html>`;
}

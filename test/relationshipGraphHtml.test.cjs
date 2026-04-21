const test = require("node:test");
const assert = require("node:assert/strict");

const { renderRelationshipGraphHtml } = require("../dist/webview/graph/presentation/renderRelationshipGraphHtml");

test("renderRelationshipGraphHtml встраивает данные графа и скрипт библиотеки", () => {
  const html = renderRelationshipGraphHtml(
    {
      nodes: [
        { id: "gleb", label: "Глеб", type: "character", filePath: "book-project/characters/gleb.md" },
        { id: "line-1", label: "Линия 1", type: "plotline", filePath: "book-project/plotlines/line-1.md" }
      ],
      edges: [{ source: "gleb", target: "line-1", label: "Пересекается" }]
    },
    "vscode-resource:graph.css",
    "vscode-resource:cytoscape.js"
  );

  assert.match(html, /Relationship Graph/);
  assert.match(html, /vscode-resource:graph\.css/);
  assert.match(html, /vscode-resource:cytoscape\.js/);
  assert.match(html, /"id":"gleb"/);
  assert.match(html, /"target":"line-1"/);
  assert.match(html, /cytoscape\(\{/);
});

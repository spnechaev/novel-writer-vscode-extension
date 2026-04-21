const test = require("node:test");
const assert = require("node:assert/strict");

const { PanelProvider } = require("../dist/webview/panelProvider");

test("buildRelationshipGraphData парсит связи персонажей из раздела ## Отношения с подзаголовками", () => {
  const provider = new PanelProvider({});

  const data = JSON.stringify({
    entities: [
      {
        frontmatter: {
          id: "gleb",
          type: "character",
          title: "Глеб",
          status: "draft",
          refs: []
        },
        filePath: "book-project/characters/gleb.md",
        body: `## Отношения
### Дмитрий
- Для Дмитрия Глеб — лицо мира, в котором ужас сначала надо правильно назвать, прежде чем разрешить заметить.

### Олег
- Открытый антагонизм: живая, несглаженная правда против процедурного выравнивания.

### Лера
- Она видит в нем не просто неприятного человека, а функцию насильственного переименования.
`
      },
      {
        frontmatter: {
          id: "dmitry",
          type: "character",
          title: "Дмитрий",
          status: "draft",
          refs: []
        },
        filePath: "book-project/characters/dmitry.md",
        body: ""
      },
      {
        frontmatter: {
          id: "oleg",
          type: "character",
          title: "Олег",
          status: "draft",
          refs: []
        },
        filePath: "book-project/characters/oleg.md",
        body: ""
      },
      {
        frontmatter: {
          id: "lera",
          type: "character",
          title: "Лера",
          status: "draft",
          refs: []
        },
        filePath: "book-project/characters/lera.md",
        body: ""
      },
      {
        frontmatter: {
          id: "line-1",
          type: "plotline",
          title: "Линия 1",
          status: "draft",
          refs: []
        },
        filePath: "book-project/plotlines/line-1.md",
        body: ""
      },
      {
        frontmatter: {
          id: "scene-1",
          type: "scene",
          title: "Сцена 1",
          status: "draft",
          refs: ["gleb", "dmitry"]
        },
        filePath: "book-project/chapters/ch-001/scenes/scene-1.md",
        body: ""
      }
    ]
  });

  const graph = provider.buildRelationshipGraphData(data);

  assert.deepEqual(
    graph.nodes.map((node) => node.id).sort(),
    ["dmitry", "gleb", "lera", "line-1", "oleg"]
  );

  assert.deepEqual(
    graph.edges
      .map((edge) => `${edge.source}->${edge.target}`)
      .sort(),
    ["gleb->dmitry", "gleb->lera", "gleb->oleg"]
  );

  assert.deepEqual(
    graph.edges
      .map((edge) => ({ key: `${edge.source}->${edge.target}`, label: edge.label }))
      .sort((left, right) => left.key.localeCompare(right.key, "ru")),
    [
      {
        key: "gleb->dmitry",
        label: "Для Дмитрия Глеб — лицо мира, в котором ужас сначала надо правильно назвать, прежде чем разрешить заметить."
      },
      {
        key: "gleb->lera",
        label: "Она видит в нем не просто неприятного человека, а функцию насильственного переименования."
      },
      {
        key: "gleb->oleg",
        label: "Открытый антагонизм: живая, несглаженная правда против процедурного выравнивания."
      }
    ]
  );
});

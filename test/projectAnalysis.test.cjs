const test = require("node:test");
const assert = require("node:assert/strict");

const { ProjectAnalysis } = require("../dist/domain/projectAnalysis");

function mkEntity(frontmatter, body = "") {
  return {
    frontmatter: {
      updatedAt: "2026-04-20T00:00:00.000Z",
      tags: [],
      refs: [],
      ...frontmatter
    },
    body,
    filePath: `book-project/${frontmatter.type}s/${frontmatter.id}.md`
  };
}

test("ProjectAnalysis собирает сигналы по незаполненным сценам и незадействованным сущностям", () => {
  const analyzer = new ProjectAnalysis();
  const result = analyzer.analyze({
    projectRoot: "book-project",
    entities: [
      mkEntity({
        id: "scene-1",
        type: "scene",
        title: "Сцена 1",
        sceneWhy: "TODO: зачем нужна сцена",
        scenePov: "",
        sceneChange: "TODO: что меняется к концу",
        scenePlotlines: []
      }),
      mkEntity({
        id: "line-1",
        type: "plotline",
        title: "Линия 1",
        status: "draft"
      }),
      mkEntity({
        id: "hero",
        type: "character",
        title: "Герой",
        status: "draft"
      }),
      mkEntity({
        id: "task-1",
        type: "editorialTask",
        title: "Проверить логику",
        status: "todo"
      })
    ]
  });

  const kinds = result.signals.map((signal) => signal.kind);
  assert.ok(kinds.includes("missing-scene-purpose"));
  assert.ok(kinds.includes("missing-scene-change"));
  assert.ok(kinds.includes("missing-scene-pov"));
  assert.ok(kinds.includes("missing-scene-plotlines"));
  assert.ok(kinds.includes("scene-without-links"));
  assert.ok(kinds.includes("plotline-without-progression"));
  assert.ok(kinds.includes("entity-without-mentions"));
  assert.ok(kinds.includes("open-editorial-task-without-links"));

  assert.equal(result.summary.sceneCount, 1);
  assert.equal(result.summary.signalCount, result.signals.length);
  assert.ok(result.passBuckets.logic.length >= 1);
});

test("ProjectAnalysis уважает analysisIgnore и не шумит там, где его попросили заткнуться", () => {
  const analyzer = new ProjectAnalysis();
  const result = analyzer.analyze({
    projectRoot: "book-project",
    entities: [
      mkEntity({
        id: "scene-2",
        type: "scene",
        title: "Сцена 2",
        analysisIgnore: ["missing-scene-purpose", "missing-scene-plotlines"],
        sceneWhy: "TODO: зачем нужна сцена",
        scenePov: "Герой",
        sceneChange: "Герой впервые врёт союзнику",
        scenePlotlines: []
      }),
      mkEntity({
        id: "line-2",
        type: "plotline",
        title: "Линия 2",
        status: "done"
      })
    ]
  });

  const kinds = result.signals.map((signal) => signal.kind);
  assert.ok(!kinds.includes("missing-scene-purpose"));
  assert.ok(!kinds.includes("missing-scene-plotlines"));
  assert.ok(!kinds.includes("plotline-without-progression"));
});

test("ProjectAnalysis подхватывает сохранённые статусы сигналов из frontmatter", () => {
  const analyzer = new ProjectAnalysis();
  const result = analyzer.analyze({
    projectRoot: "book-project",
    entities: [
      mkEntity({
        id: "scene-3",
        type: "scene",
        title: "Сцена 3",
        analysisSignals: {
          "missing-scene-purpose": "deferred",
          "missing-scene-change": "resolved"
        },
        sceneWhy: "TODO: зачем нужна сцена",
        scenePov: "Герой",
        sceneChange: "TODO: что меняется к концу",
        scenePlotlines: []
      })
    ]
  });

  const deferredSignal = result.signals.find((signal) => signal.kind === "missing-scene-purpose");
  const resolvedSignal = result.signals.find((signal) => signal.kind === "missing-scene-change");
  assert.equal(deferredSignal?.status, "deferred");
  assert.equal(resolvedSignal?.status, "resolved");
});

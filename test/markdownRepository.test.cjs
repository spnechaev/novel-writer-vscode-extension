const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const matter = require("gray-matter");

const { FileSystemProjectRepository } = require("../dist/project/infrastructure/persistence/fileSystemProjectRepository");

async function mkWorkspace() {
  return fs.mkdtemp(path.join(os.tmpdir(), "novelwriter-test-"));
}

async function readUtf8(filePath) {
  return fs.readFile(filePath, "utf8");
}

test("initializeProject создаёт структуру и базовые файлы", async () => {
  const workspaceRoot = await mkWorkspace();
  const repo = new FileSystemProjectRepository(workspaceRoot);

  await repo.initializeProject();

  const expectedPaths = [
    "book-project/.bookmeta",
    "book-project/characters",
    "book-project/plotlines",
    "book-project/relationships",
    "book-project/chapters/ch-001/scenes",
    "book-project/editorial/tasks",
    "book-project/editorial/checklists",
    "book-project/project.md",
    "book-project/.bookmeta/schema-version.md",
    "book-project/.bookmeta/export-typography.json",
    "book-project/editorial/tasks/first-pass.md",
    "book-project/editorial/checklists/draft-checklist.md"
  ];

  for (const rel of expectedPaths) {
    await assert.doesNotReject(fs.stat(path.join(workspaceRoot, rel)));
  }
});

test("createEntity для scene создаёт файл с расширенным frontmatter", async () => {
  const workspaceRoot = await mkWorkspace();
  const repo = new FileSystemProjectRepository(workspaceRoot);

  const uri = await repo.createEntity("scene", "Первая Сцена");
  const text = await readUtf8(uri.fsPath);
  const parsed = matter(text);

  assert.equal(parsed.data.type, "scene");
  assert.equal(parsed.data.title, "Первая Сцена");
  assert.equal(parsed.data.id, "первая-сцена");
  assert.equal(parsed.data.sceneWhat, "TODO: что происходит в сцене");
  assert.deepEqual(parsed.data.scenePlotlines, ["основная-линия"]);
  assert.match(parsed.content, /## Текст сцены/);
  assert.match(uri.fsPath, /book-project\/chapters\/ch-001\/scenes\/первая-сцена\.md$/);
});

test("readIndex возвращает только валидные сущности", async () => {
  const workspaceRoot = await mkWorkspace();
  const repo = new FileSystemProjectRepository(workspaceRoot);

  await repo.initializeProject();
  await repo.createEntity("character", "Герой");
  await repo.createEntity("chapter", "Глава Один");

  const invalidPath = path.join(workspaceRoot, "book-project/characters/broken.md");
  await fs.mkdir(path.dirname(invalidPath), { recursive: true });
  await fs.writeFile(invalidPath, "# no frontmatter\n", "utf8");

  const index = await repo.readIndex();

  assert.equal(index.projectRoot, "book-project");
  assert.ok(index.entities.length >= 2);

  const ids = index.entities.map((e) => String(e.frontmatter.id));
  assert.ok(ids.includes("герой"));
  assert.ok(ids.includes("глава-один"));
  assert.ok(!ids.includes("broken"));

  for (const entity of index.entities) {
    assert.equal(typeof entity.filePath, "string");
    assert.ok(!path.isAbsolute(entity.filePath));
  }
});

test("updateAnalysisSignalStatus сохраняет статусы сигналов в frontmatter", async () => {
  const workspaceRoot = await mkWorkspace();
  const repo = new FileSystemProjectRepository(workspaceRoot);

  const uri = await repo.createEntity("scene", "Сцена со статусом");
  await repo.updateAnalysisSignalStatus(uri.fsPath, "missing-scene-purpose", "deferred");

  let text = await readUtf8(uri.fsPath);
  let parsed = matter(text);
  assert.equal(parsed.data.analysisSignals["missing-scene-purpose"], "deferred");

  await repo.updateAnalysisSignalStatus(uri.fsPath, "missing-scene-purpose", "open");
  text = await readUtf8(uri.fsPath);
  parsed = matter(text);
  assert.equal(parsed.data.analysisSignals, undefined);
});

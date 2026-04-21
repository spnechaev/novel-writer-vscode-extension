import * as path from "node:path";
import * as vscode from "vscode";
import matter from "gray-matter";
import { AnalysisSignalStatus } from "../../../analysis/domain/types/analysisTypes";
import { BookProjectIndex, EntityRecord, EntityType, FrontmatterBase } from "../../domain/types/projectTypes";
import { BOOK_ROOT, PROJECT_PATHS } from "../config/projectPaths";

const ENTITY_GLOB = "{characters,plotlines,relationships,editorial/tasks,editorial/checklists}/**/*.md";

export class FileSystemProjectRepository {
  constructor(private readonly workspaceRoot: string) {}

  async initializeProject(): Promise<void> {
    const directories = [
      BOOK_ROOT,
      `${BOOK_ROOT}/.bookmeta`,
      PROJECT_PATHS.charactersDir,
      PROJECT_PATHS.plotlinesDir,
      PROJECT_PATHS.relationshipsDir,
      PROJECT_PATHS.chaptersDir,
      `${PROJECT_PATHS.chaptersDir}/ch-001/scenes`,
      `${BOOK_ROOT}/editorial`,
      PROJECT_PATHS.editorialTasksDir,
      PROJECT_PATHS.editorialChecklistsDir
    ];

    for (const dir of directories) {
      await vscode.workspace.fs.createDirectory(this.toUri(dir));
    }

    await this.writeIfMissing(
      PROJECT_PATHS.project,
      this.stringify({
        id: "project-main",
        type: "chapter",
        title: "Book Project",
        status: "draft",
        tags: [],
        refs: [],
        updatedAt: new Date().toISOString()
      }, "# Book Project\n\nDefine synopsis, tone and constraints.")
    );

    await this.writeIfMissing(PROJECT_PATHS.schemaVersion, "schemaVersion: 1\n");

    await this.writeIfMissing(
      PROJECT_PATHS.exportTypographyConfig,
      JSON.stringify(
        {
          bodyFontFamily: "Times New Roman",
          bodyFontSizePt: 12
        },
        null,
        2
      ) + "\n"
    );

    await this.writeIfMissing(
      `${PROJECT_PATHS.editorialTasksDir}/first-pass.md`,
      this.stringify(
        {
          id: "first-pass",
          type: "editorialTask",
          title: "First editorial pass",
          status: "todo",
          tags: ["editorial"],
          refs: [],
          updatedAt: new Date().toISOString()
        },
        "# First editorial pass\n\nReview chapter flow and consistency."
      )
    );

    await this.writeIfMissing(
      `${PROJECT_PATHS.editorialChecklistsDir}/draft-checklist.md`,
      this.stringify(
        {
          id: "draft-checklist",
          type: "checklist",
          title: "Draft checklist",
          status: "todo",
          tags: ["checklist"],
          refs: [],
          updatedAt: new Date().toISOString()
        },
        "# Draft checklist\n\n- [ ] Continuity\n- [ ] Character voice\n- [ ] Scene pacing"
      )
    );
  }

  async createEntity(type: EntityType, title: string): Promise<vscode.Uri> {
    const now = new Date().toISOString();
    const id = slugify(title);
    const filePath = this.getEntityPath(type, id);

    const base: FrontmatterBase = {
      id,
      type,
      title,
      status: "todo",
      tags: [],
      refs: [],
      updatedAt: now
    };

    const frontmatter: FrontmatterBase & Record<string, unknown> =
      type === "scene"
        ? {
            ...base,
            sceneWhat: "TODO: что происходит в сцене",
            sceneWhy: "TODO: зачем нужна сцена",
            scenePov: "TODO: чьими глазами",
            sceneChange: "TODO: что меняется к концу",
            scenePlotlines: ["основная-линия"]
          }
        : { ...base };

    const body = type === "scene" ? this.sceneBodyTemplate() : `# ${title}\n\n`;

    await this.writeFile(filePath, this.stringify(frontmatter, body));
    return this.toUri(filePath);
  }

  async readIndex(): Promise<BookProjectIndex> {
    const pattern = new vscode.RelativePattern(this.workspaceRoot, `${BOOK_ROOT}/${ENTITY_GLOB}`);
    const chapterPattern = new vscode.RelativePattern(this.workspaceRoot, `${BOOK_ROOT}/chapters/**/{chapter,*.md}`);
    const [files, chapterFiles] = await Promise.all([
      vscode.workspace.findFiles(pattern),
      vscode.workspace.findFiles(chapterPattern)
    ]);

    const allFiles = dedupeUris([...files, ...chapterFiles]);
    const entities: EntityRecord[] = [];

    for (const file of allFiles) {
      const raw = Buffer.from(await vscode.workspace.fs.readFile(file)).toString("utf8");
      const parsed = matter(raw);
      if (!parsed.data?.id || !parsed.data?.type || !parsed.data?.title) {
        continue;
      }

      entities.push({
        frontmatter: parsed.data as FrontmatterBase & Record<string, unknown>,
        body: parsed.content,
        filePath: path.relative(this.workspaceRoot, file.fsPath)
      });
    }

    return {
      projectRoot: BOOK_ROOT,
      entities
    };
  }

  async updateAnalysisSignalStatus(filePath: string, signalKind: string, status: AnalysisSignalStatus): Promise<void> {
    const relativePath = path.isAbsolute(filePath) ? path.relative(this.workspaceRoot, filePath) : filePath;
    const uri = this.toUri(relativePath);
    const raw = Buffer.from(await vscode.workspace.fs.readFile(uri)).toString("utf8");
    const parsed = matter(raw);
    const frontmatter = { ...(parsed.data as Record<string, unknown>) };
    const currentSignals = readAnalysisSignals(frontmatter.analysisSignals);

    if (status === "open") {
      delete currentSignals[signalKind];
    } else {
      currentSignals[signalKind] = status;
    }

    if (Object.keys(currentSignals).length > 0) {
      frontmatter.analysisSignals = currentSignals;
    } else {
      delete frontmatter.analysisSignals;
    }

    if (Array.isArray(frontmatter.analysisIgnore)) {
      const nextIgnore = frontmatter.analysisIgnore
        .filter((item): item is string => typeof item === "string")
        .filter((item) => item !== signalKind);

      if (status === "ignored") {
        nextIgnore.push(signalKind);
      }

      if (nextIgnore.length > 0) {
        frontmatter.analysisIgnore = [...new Set(nextIgnore)];
      } else {
        delete frontmatter.analysisIgnore;
      }
    }

    await this.writeFile(relativePath, this.stringify(frontmatter, parsed.content));
  }

  private sceneBodyTemplate(): string {
    return `## Текст сцены

`;
  }

  private getEntityPath(type: EntityType, id: string): string {
    switch (type) {
      case "character":
        return `${PROJECT_PATHS.charactersDir}/${id}.md`;
      case "plotline":
        return `${PROJECT_PATHS.plotlinesDir}/${id}.md`;
      case "relationship":
        return `${PROJECT_PATHS.relationshipsDir}/${id}.md`;
      case "chapter":
        return `${PROJECT_PATHS.chaptersDir}/${id}/chapter.md`;
      case "scene":
        return `${PROJECT_PATHS.chaptersDir}/ch-001/scenes/${id}.md`;
      case "editorialTask":
        return `${PROJECT_PATHS.editorialTasksDir}/${id}.md`;
      case "checklist":
        return `${PROJECT_PATHS.editorialChecklistsDir}/${id}.md`;
      default:
        return `${PROJECT_PATHS.charactersDir}/${id}.md`;
    }
  }

  private async writeIfMissing(relativePath: string, content: string): Promise<void> {
    const uri = this.toUri(relativePath);
    try {
      await vscode.workspace.fs.stat(uri);
    } catch {
      await this.writeFile(relativePath, content);
    }
  }

  private async writeFile(relativePath: string, content: string): Promise<void> {
    const uri = this.toUri(relativePath);
    const dir = path.dirname(uri.fsPath);
    await vscode.workspace.fs.createDirectory(vscode.Uri.file(dir));
    await vscode.workspace.fs.writeFile(uri, Buffer.from(content, "utf8"));
  }

  private stringify(frontmatter: object, body: string): string {
    return matter.stringify(body, frontmatter);
  }

  private toUri(relativePath: string): vscode.Uri {
    return vscode.Uri.file(path.join(this.workspaceRoot, relativePath));
  }
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-zа-я0-9]+/gi, "-")
    .replace(/(^-|-$)/g, "") || `id-${Date.now()}`;
}

function dedupeUris(uris: vscode.Uri[]): vscode.Uri[] {
  const seen = new Set<string>();
  const result: vscode.Uri[] = [];
  for (const uri of uris) {
    if (seen.has(uri.fsPath)) {
      continue;
    }
    seen.add(uri.fsPath);
    result.push(uri);
  }
  return result;
}

function readAnalysisSignals(value: unknown): Record<string, AnalysisSignalStatus> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const result: Record<string, AnalysisSignalStatus> = {};
  for (const [key, rawStatus] of Object.entries(value)) {
    if (rawStatus === "open" || rawStatus === "ignored" || rawStatus === "resolved" || rawStatus === "deferred") {
      result[key] = rawStatus;
    }
  }

  return result;
}

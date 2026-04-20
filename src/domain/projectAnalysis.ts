import {
  AnalysisSignal,
  AnalysisSignalKind,
  BookProjectIndex,
  EditorialPass,
  FrontmatterBase,
  NormalizedEntityRecord,
  NormalizedSceneMeta,
  ProjectAnalysisResult
} from "../types";

const TODO_PATTERN = /^todo(?::|\b)/i;
const CLOSED_STATUSES = new Set(["done", "closed", "resolved", "complete", "completed"]);

export class ProjectAnalysis {
  analyze(index: BookProjectIndex): ProjectAnalysisResult {
    const entities = index.entities.map((entity) => normalizeEntity(entity));
    const entityById = new Map(entities.map((entity) => [entity.id, entity]));
    const inboundRefs = buildInboundRefs(entities);
    const signals = dedupeSignals([
      ...this.collectForgottenSignals(entities, inboundRefs),
      ...this.collectLooseEndSignals(entities, inboundRefs, entityById)
    ]);

    return {
      generatedAt: new Date().toISOString(),
      summary: {
        entityCount: entities.length,
        sceneCount: entities.filter((entity) => entity.type === "scene").length,
        signalCount: signals.length,
        criticalCount: signals.filter((signal) => signal.severity === "critical").length,
        warningCount: signals.filter((signal) => signal.severity === "warning").length,
        infoCount: signals.filter((signal) => signal.severity === "info").length
      },
      entities,
      signals,
      passBuckets: {
        logic: signals.filter((signal) => signal.passes.includes("logic")),
        rhythm: signals.filter((signal) => signal.passes.includes("rhythm")),
        style: signals.filter((signal) => signal.passes.includes("style"))
      }
    };
  }

  private collectForgottenSignals(
    entities: NormalizedEntityRecord[],
    inboundRefs: Map<string, Set<string>>
  ): AnalysisSignal[] {
    const signals: AnalysisSignal[] = [];
    const scenes = entities.filter((entity) => entity.type === "scene");

    for (const scene of scenes) {
      if (!scene.scene) {
        continue;
      }

      if (isMissingValue(scene.scene.why) && !isIgnored(scene, "missing-scene-purpose")) {
        signals.push(
          createSignal(scene, {
            kind: "missing-scene-purpose",
            group: "forgotten",
            severity: "critical",
            title: "У сцены не заполнена цель",
            description: "Сцена есть, но неясно, зачем она нужна в общей конструкции текста.",
            suggestedAction: "Заполните sceneWhy или уточните, какой драматический смысл несёт сцена.",
            passes: ["logic"]
          })
        );
      }

      if (isMissingValue(scene.scene.change) && !isIgnored(scene, "missing-scene-change")) {
        signals.push(
          createSignal(scene, {
            kind: "missing-scene-change",
            group: "forgotten",
            severity: "critical",
            title: "У сцены не видно изменения к финалу",
            description: "Сцена не фиксирует, что именно изменилось к концу, поэтому легко превращается в красивую, но пустую мебель.",
            suggestedAction: "Заполните sceneChange и проверьте, приводит ли сцена к новому состоянию героя, конфликта или линии.",
            passes: ["logic", "rhythm"]
          })
        );
      }

      if (isMissingValue(scene.scene.pov) && !isIgnored(scene, "missing-scene-pov")) {
        signals.push(
          createSignal(scene, {
            kind: "missing-scene-pov",
            group: "forgotten",
            severity: "warning",
            title: "У сцены не указан POV",
            description: "Для сцены не задано, чьими глазами она показана. Это часто ведёт к расползанию фокуса.",
            suggestedAction: "Заполните scenePov, чтобы закрепить точку зрения и не размазывать внимание по стенам.",
            passes: ["logic"]
          })
        );
      }

      if (scene.scene.plotlines.length === 0 && !isIgnored(scene, "missing-scene-plotlines")) {
        signals.push(
          createSignal(scene, {
            kind: "missing-scene-plotlines",
            group: "forgotten",
            severity: "warning",
            title: "Сцена не привязана ни к одной линии",
            description: "У сцены нет привязки к сюжетным линиям, поэтому она выглядит оторванной от остального каркаса рукописи.",
            suggestedAction: "Добавьте scenePlotlines или сознательно пометьте сцену как исключение.",
            passes: ["logic"]
          })
        );
      }

      const sceneInbound = inboundRefs.get(scene.id)?.size ?? 0;
      const sceneOutbound = scene.refs.length + scene.scene.plotlines.length;
      if (sceneInbound === 0 && sceneOutbound === 0 && !isIgnored(scene, "scene-without-links")) {
        signals.push(
          createSignal(scene, {
            kind: "scene-without-links",
            group: "forgotten",
            severity: "info",
            title: "Сцена висит отдельно от остальных сущностей",
            description: "У сцены нет ни входящих, ни исходящих связей. Иногда это норма, но чаще — сигнал проверить причинность и последствия.",
            suggestedAction: "Проверьте refs и scenePlotlines, чтобы сцена не болталась в проекте как потерянный чемодан.",
            passes: ["logic", "rhythm"]
          })
        );
      }
    }

    for (const entity of entities.filter((item) => item.type === "plotline")) {
      const hasSceneProgression = scenes.some((scene) => scene.scene?.plotlines.includes(entity.id));
      if (!hasSceneProgression && !isClosedStatus(entity.status) && !isIgnored(entity, "plotline-without-progression")) {
        signals.push(
          createSignal(entity, {
            kind: "plotline-without-progression",
            group: "forgotten",
            severity: "warning",
            title: "Линия заведена, но не двигается в сценах",
            description: "Сюжетная линия существует как сущность, но ни одна сцена не отмечена как её развитие.",
            suggestedAction: "Привяжите линию к сценам через scenePlotlines или закройте её, если она больше не нужна.",
            passes: ["logic"]
          })
        );
      }
    }

    for (const entity of entities.filter((item) => item.type === "character" || item.type === "relationship")) {
      const inbound = inboundRefs.get(entity.id)?.size ?? 0;
      if (inbound === 0 && entity.refs.length === 0 && !isClosedStatus(entity.status) && !isIgnored(entity, "entity-without-mentions")) {
        signals.push(
          createSignal(entity, {
            kind: "entity-without-mentions",
            group: "forgotten",
            severity: "info",
            title: "Сущность заведена, но нигде не всплывает",
            description: "Персонаж или отношение есть в проекте, но никто на них не ссылается и они сами никуда не привязаны.",
            suggestedAction: "Проверьте refs, добавьте использование в сценах или закройте сущность, если она была черновым ложным стартом.",
            passes: ["logic"]
          })
        );
      }
    }

    return signals;
  }

  private collectLooseEndSignals(
    entities: NormalizedEntityRecord[],
    inboundRefs: Map<string, Set<string>>,
    entityById: Map<string, NormalizedEntityRecord>
  ): AnalysisSignal[] {
    const signals: AnalysisSignal[] = [];

    for (const task of entities.filter((entity) => entity.type === "editorialTask")) {
      const inbound = inboundRefs.get(task.id)?.size ?? 0;
      if (inbound === 0 && task.refs.length === 0 && !isClosedStatus(task.status) && !isIgnored(task, "open-editorial-task-without-links")) {
        signals.push(
          createSignal(task, {
            kind: "open-editorial-task-without-links",
            group: "looseEnd",
            severity: "warning",
            title: "Редакторская задача висит без привязки",
            description: "Задача открыта, но не ссылается ни на одну сцену, главу или сущность и сама нигде не упоминается.",
            suggestedAction: "Привяжите задачу через refs к конкретному месту текста или закройте её, если она уже пережила свою полезность.",
            passes: ["logic"]
          })
        );
      }
    }

    for (const relationship of entities.filter((entity) => entity.type === "relationship")) {
      const inbound = inboundRefs.get(relationship.id)?.size ?? 0;
      const relatedKnownEntities = relationship.refs.filter((ref) => entityById.has(ref)).length;
      if (inbound === 0 && relatedKnownEntities === 0 && !isClosedStatus(relationship.status) && !isIgnored(relationship, "open-relationship-without-links")) {
        signals.push(
          createSignal(relationship, {
            kind: "open-relationship-without-links",
            group: "looseEnd",
            severity: "warning",
            title: "Отношение заведено, но не встроено в проект",
            description: "Отношение существует само по себе и не связано с персонажами или сценами. Это очень похоже на незакрытый хвост структуры.",
            suggestedAction: "Добавьте refs на участников отношения и свяжите его со сценами, где оно меняется.",
            passes: ["logic"]
          })
        );
      }
    }

    return signals;
  }
}

function normalizeEntity(entity: BookProjectIndex["entities"][number]): NormalizedEntityRecord {
  const frontmatter = entity.frontmatter as FrontmatterBase & Record<string, unknown>;

  return {
    id: String(frontmatter.id),
    type: frontmatter.type,
    title: String(frontmatter.title),
    status: normalizeText(frontmatter.status) || "todo",
    tags: normalizeStringArray(frontmatter.tags),
    refs: normalizeStringArray(frontmatter.refs),
    analysisIgnore: normalizeStringArray(frontmatter.analysisIgnore),
    analysisSignals: normalizeAnalysisSignals(frontmatter.analysisSignals),
    updatedAt: String(frontmatter.updatedAt),
    updatedAtMs: normalizeTimestamp(frontmatter.updatedAt),
    body: entity.body,
    filePath: entity.filePath,
    scene: frontmatter.type === "scene" ? normalizeScene(frontmatter) : undefined
  };
}

function normalizeScene(frontmatter: Record<string, unknown>): NormalizedSceneMeta {
  return {
    what: normalizeText(frontmatter.sceneWhat),
    why: normalizeText(frontmatter.sceneWhy),
    pov: normalizeText(frontmatter.scenePov),
    change: normalizeText(frontmatter.sceneChange),
    plotlines: normalizeStringArray(frontmatter.scenePlotlines).filter((item) => !TODO_PATTERN.test(item))
  };
}

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeTimestamp(value: unknown): number {
  if (typeof value !== "string") {
    return 0;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildInboundRefs(entities: NormalizedEntityRecord[]): Map<string, Set<string>> {
  const inbound = new Map<string, Set<string>>();

  for (const entity of entities) {
    const refs = new Set<string>(entity.refs);
    if (entity.scene) {
      for (const plotlineId of entity.scene.plotlines) {
        refs.add(plotlineId);
      }
    }

    for (const ref of refs) {
      if (!inbound.has(ref)) {
        inbound.set(ref, new Set<string>());
      }
      inbound.get(ref)?.add(entity.id);
    }
  }

  return inbound;
}

function isMissingValue(value: string): boolean {
  return !value || TODO_PATTERN.test(value);
}

function isClosedStatus(status: string): boolean {
  return CLOSED_STATUSES.has(status.toLowerCase());
}

function isIgnored(entity: NormalizedEntityRecord, kind: AnalysisSignalKind): boolean {
  return entity.analysisIgnore.includes(kind);
}

function readSignalStatus(entity: NormalizedEntityRecord, kind: AnalysisSignalKind): AnalysisSignal["status"] {
  const stored = entity.analysisSignals[kind];
  if (stored === "open" || stored === "ignored" || stored === "resolved" || stored === "deferred") {
    return stored;
  }

  return isIgnored(entity, kind) ? "ignored" : "open";
}

function createSignal(
  entity: NormalizedEntityRecord,
  input: Omit<AnalysisSignal, "id" | "status" | "entityId" | "filePath" | "relatedEntityIds"> & {
    relatedEntityIds?: string[];
  }
): AnalysisSignal {
  return {
    id: `${input.kind}:${entity.id}`,
    kind: input.kind,
    group: input.group,
    severity: input.severity,
    status: readSignalStatus(entity, input.kind),
    entityId: entity.id,
    filePath: entity.filePath,
    title: input.title,
    description: input.description,
    suggestedAction: input.suggestedAction,
    passes: uniquePasses(input.passes),
    relatedEntityIds: input.relatedEntityIds ?? []
  };
}

function uniquePasses(passes: EditorialPass[]): EditorialPass[] {
  return [...new Set(passes)];
}

function dedupeSignals(signals: AnalysisSignal[]): AnalysisSignal[] {
  const seen = new Set<string>();
  const result: AnalysisSignal[] = [];

  for (const signal of signals) {
    if (seen.has(signal.id)) {
      continue;
    }

    seen.add(signal.id);
    result.push(signal);
  }

  return result.sort((left, right) => severityWeight(right.severity) - severityWeight(left.severity));
}

function severityWeight(severity: AnalysisSignal["severity"]): number {
  switch (severity) {
    case "critical":
      return 3;
    case "warning":
      return 2;
    case "info":
    default:
      return 1;
  }
}

function normalizeAnalysisSignals(value: unknown): Partial<Record<AnalysisSignalKind, AnalysisSignal["status"]>> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const result: Partial<Record<AnalysisSignalKind, AnalysisSignal["status"]>> = {};
  for (const [kind, rawStatus] of Object.entries(value)) {
    if (!isAnalysisSignalKind(kind)) {
      continue;
    }

    if (rawStatus === "open" || rawStatus === "ignored" || rawStatus === "resolved" || rawStatus === "deferred") {
      result[kind] = rawStatus;
    }
  }

  return result;
}

function isAnalysisSignalKind(value: string): value is AnalysisSignalKind {
  return [
    "missing-scene-purpose",
    "missing-scene-change",
    "missing-scene-pov",
    "missing-scene-plotlines",
    "scene-without-links",
    "plotline-without-progression",
    "entity-without-mentions",
    "open-editorial-task-without-links",
    "open-relationship-without-links"
  ].includes(value);
}

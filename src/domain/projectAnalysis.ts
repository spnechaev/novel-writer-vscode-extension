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
import { analyzeMarkdownText } from "../diagnostics/languageDiagnostics";

const TODO_PATTERN = /^todo(?::|\b)/i;
const CLOSED_STATUSES = new Set(["done", "closed", "resolved", "complete", "completed"]);

export class ProjectAnalysis {
  analyze(index: BookProjectIndex): ProjectAnalysisResult {
    const entities = index.entities.map((entity) => normalizeEntity(entity));
    const entityById = new Map(entities.map((entity) => [entity.id, entity]));
    const inboundRefs = buildInboundRefs(entities);
    const sceneMentionStats = buildSceneMentionStats(entities, entityById);
    const signals = dedupeSignals([
      ...this.collectForgottenSignals(entities, inboundRefs),
      ...this.collectLooseEndSignals(entities, inboundRefs, entityById),
      ...this.collectFocusPassSignals(entities, sceneMentionStats)
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
        style: signals.filter((signal) => signal.passes.includes("style")),
        texture: signals.filter((signal) => signal.passes.includes("texture")),
        repetition: signals.filter((signal) => signal.passes.includes("repetition"))
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

  private collectFocusPassSignals(
    entities: NormalizedEntityRecord[],
    sceneMentionStats: Map<string, { count: number; lastSceneIndex: number }>
  ): AnalysisSignal[] {
    const signals: AnalysisSignal[] = [];
    const scenes = entities.filter(
      (entity): entity is NormalizedEntityRecord & { scene: NormalizedSceneMeta } => entity.type === "scene" && Boolean(entity.scene)
    );

    for (const scene of scenes) {
      const sceneText = stripSceneMarkup(scene.body);
      const wordCount = countWords(sceneText);

      if (wordCount > 0 && wordCount < 35 && !isIgnored(scene, "scene-low-texture")) {
        signals.push(
          createSignal(scene, {
            kind: "scene-low-texture",
            group: "focusPass",
            severity: "info",
            title: "Сцена пока слишком сухая по фактуре",
            description: "В сцене слишком мало живого материала, чтобы держать атмосферу, телесность и среду без таблички 'поверь на слово'.",
            suggestedAction: "Проверьте, хватает ли в сцене конкретики, ощущений и среды, а не только каркасного пересказа.",
            passes: ["texture"]
          })
        );
      }

      const repeatedWord = findRepeatedWord(sceneText);
      if (repeatedWord && !isIgnored(scene, "scene-repetition-cluster")) {
        signals.push(
          createSignal(scene, {
            kind: "scene-repetition-cluster",
            group: "focusPass",
            severity: "warning",
            title: "В сцене копится словесный повтор",
            description: `Слово "${repeatedWord.word}" повторяется ${repeatedWord.count} раз и начинает жевать интонацию вместо того, чтобы работать на неё.`,
            suggestedAction: "Пройдитесь по сцене проходом на повторы и раскидайте одинаковые слова по более живым формулировкам.",
            passes: ["repetition", "style"]
          })
        );
      }

      const hints = analyzeMarkdownText(sceneText);
      const fillerCount = hints.filter((hint) => hint.kind === "filler-word").length;
      const repeatedPunctuationCount = hints.filter((hint) => hint.kind === "repeated-punctuation").length;
      const spacingCount = hints.filter((hint) => hint.kind === "space-before-punctuation").length;

      if (fillerCount >= 2 && !isIgnored(scene, "style-filler-words")) {
        signals.push(
          createSignal(scene, {
            kind: "style-filler-words",
            group: "focusPass",
            severity: "info",
            title: "В сцене многовато слов-подпорок",
            description: `Анализатор нашёл ${fillerCount} слов-паразитов или подпорок. Текст от этого звучит мягче и водянистее, чем хотелось бы.`,
            suggestedAction: "Проверьте сцену стилевым проходом и вырежьте слова, которые ничего не двигают, кроме воздуха между мыслями.",
            passes: ["style"]
          })
        );
      }

      if (repeatedPunctuationCount > 0 && !isIgnored(scene, "style-repeated-punctuation")) {
        signals.push(
          createSignal(scene, {
            kind: "style-repeated-punctuation",
            group: "focusPass",
            severity: "warning",
            title: "В сцене замечена истерика пунктуации",
            description: `Анализатор нашёл ${repeatedPunctuationCount} случая(ев) повторной пунктуации, которая больше шумит, чем работает на фразу.`,
            suggestedAction: "Проверьте, не пытается ли текст доорать эмоцию через знаки вместо того, чтобы нормально построить интонацию.",
            passes: ["style", "repetition"]
          })
        );
      }

      if (spacingCount > 0 && !isIgnored(scene, "style-space-before-punctuation")) {
        signals.push(
          createSignal(scene, {
            kind: "style-space-before-punctuation",
            group: "focusPass",
            severity: "info",
            title: "В сцене есть технический мусор перед пунктуацией",
            description: `Анализатор нашёл ${spacingCount} места, где перед знаком препинания остался лишний пробел.`,
            suggestedAction: "Почистите технические огрехи, чтобы стиль не спотыкался на мелком, но липком мусоре.",
            passes: ["style"]
          })
        );
      }
    }

    const scenesByChapter = groupScenesByChapter(scenes);
    for (const chapterScenes of scenesByChapter.values()) {
      const orderedScenes = [...chapterScenes].sort((left, right) => left.filePath.localeCompare(right.filePath, "ru"));
      let streak: Array<NormalizedEntityRecord & { scene: NormalizedSceneMeta }> = [];

      for (const scene of orderedScenes) {
        const pov = scene.scene.pov;
        if (!pov) {
          streak = [];
          continue;
        }

        if (!streak.length || streak[streak.length - 1].scene.pov === pov) {
          streak.push(scene);
        } else {
          streak = [scene];
        }

        if (streak.length >= 3 && !isIgnored(scene, "scene-monotony")) {
          signals.push(
            createSignal(scene, {
              kind: "scene-monotony",
              group: "focusPass",
              severity: "warning",
              title: "Подряд идёт слишком однообразный POV",
              description: `Уже ${streak.length} сцены подряд держатся на одном POV: ${pov}. Ритм начинает маршировать строем и понемногу засыпать.`,
              suggestedAction: "Проверьте, нужен ли здесь сдвиг фокуса, смена режима сцены или хотя бы другое драматическое давление.",
              passes: ["rhythm"],
              relatedEntityIds: streak.map((item) => item.id)
            })
          );
        }
      }
    }

    if (scenes.length >= 5) {
      for (const entity of entities.filter((item) => item.type === "character")) {
        const stats = sceneMentionStats.get(entity.id);
        if (!stats || stats.count === 0 || isIgnored(entity, "character-dropped-from-scenes") || isClosedStatus(entity.status)) {
          continue;
        }

        const scenesSinceLastMention = scenes.length - stats.lastSceneIndex - 1;
        if (scenesSinceLastMention >= 4) {
          signals.push(
            createSignal(entity, {
              kind: "character-dropped-from-scenes",
              group: "focusPass",
              severity: "info",
              title: "Персонаж выпал из последних сцен",
              description: `Персонаж не появлялся уже ${scenesSinceLastMention} сцены подряд. Это не всегда ошибка, но хороший повод перепроверить баланс присутствия.`,
              suggestedAction: "Проверьте, это сознательное исчезновение или персонаж просто провалился в щель между сценами, как это у них бывает.",
              passes: ["logic", "rhythm"]
            })
          );
        }
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

function stripSceneMarkup(text: string): string {
  return text
    .replace(/^#+\s.*$/gm, " ")
    .replace(/[`*_>#\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function countWords(text: string): number {
  return text.match(/[a-zа-яё0-9]+/gi)?.length ?? 0;
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

function buildSceneMentionStats(
  entities: NormalizedEntityRecord[],
  entityById: Map<string, NormalizedEntityRecord>
): Map<string, { count: number; lastSceneIndex: number }> {
  const stats = new Map<string, { count: number; lastSceneIndex: number }>();
  const scenes = entities
    .filter((entity): entity is NormalizedEntityRecord & { scene: NormalizedSceneMeta } => entity.type === "scene" && Boolean(entity.scene))
    .sort((left, right) => left.filePath.localeCompare(right.filePath, "ru"));

  const characterLookup = new Map<string, string[]>();
  for (const entity of entities.filter((item) => item.type === "character")) {
    addLookup(characterLookup, entity.id, entity.id);
    addLookup(characterLookup, entity.title, entity.id);
  }

  scenes.forEach((scene, index) => {
    const mentioned = new Set<string>(scene.refs.filter((ref) => entityById.get(ref)?.type === "character"));
    const pov = normalizeLookupKey(scene.scene.pov);
    for (const characterId of characterLookup.get(pov) ?? []) {
      mentioned.add(characterId);
    }

    for (const characterId of mentioned) {
      const previous = stats.get(characterId);
      stats.set(characterId, {
        count: (previous?.count ?? 0) + 1,
        lastSceneIndex: index
      });
    }
  });

  return stats;
}

function groupScenesByChapter<T extends NormalizedEntityRecord>(scenes: T[]): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const scene of scenes) {
    const chapterKey = extractChapterKey(scene.filePath);
    if (!grouped.has(chapterKey)) {
      grouped.set(chapterKey, []);
    }
    grouped.get(chapterKey)?.push(scene);
  }
  return grouped;
}

function extractChapterKey(filePath: string): string {
  const parts = filePath.split("/");
  const chapterIndex = parts.indexOf("chapters");
  if (chapterIndex >= 0 && parts[chapterIndex + 1]) {
    return parts[chapterIndex + 1];
  }
  return "unknown-chapter";
}

function addLookup(map: Map<string, string[]>, source: string, entityId: string): void {
  const key = normalizeLookupKey(source);
  if (!key) {
    return;
  }

  const existing = map.get(key) ?? [];
  if (!existing.includes(entityId)) {
    existing.push(entityId);
  }
  map.set(key, existing);
}

function normalizeLookupKey(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-zа-яё0-9]+/gi, "-")
    .replace(/(^-|-$)/g, "");
}

function findRepeatedWord(text: string): { word: string; count: number } | null {
  const words = (text.toLowerCase().match(/[a-zа-яё]{4,}/gi) ?? []).filter((word) => !COMMON_WORDS.has(word));
  const counts = new Map<string, number>();

  for (const word of words) {
    counts.set(word, (counts.get(word) ?? 0) + 1);
  }

  let best: { word: string; count: number } | null = null;
  for (const [word, count] of counts.entries()) {
    if (count < 5) {
      continue;
    }
    if (!best || count > best.count) {
      best = { word, count };
    }
  }

  return best;
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
    "scene-low-texture",
    "scene-monotony",
    "scene-repetition-cluster",
    "character-dropped-from-scenes",
    "plotline-without-progression",
    "entity-without-mentions",
    "style-filler-words",
    "style-space-before-punctuation",
    "style-repeated-punctuation",
    "open-editorial-task-without-links",
    "open-relationship-without-links"
  ].includes(value);
}

const COMMON_WORDS = new Set([
  "когда",
  "потому",
  "который",
  "которая",
  "которые",
  "чтобы",
  "этого",
  "этот",
  "после",
  "before",
  "after",
  "there",
  "their",
  "because",
  "about"
]);

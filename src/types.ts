export type EntityType =
  | "character"
  | "plotline"
  | "relationship"
  | "chapter"
  | "scene"
  | "editorialTask"
  | "checklist";

export type EditorialPass = "logic" | "rhythm" | "style" | "texture" | "repetition";

export type AnalysisSignalGroup = "forgotten" | "looseEnd" | "focusPass";

export type AnalysisSignalSeverity = "info" | "warning" | "critical";

export type AnalysisSignalStatus = "open" | "ignored" | "resolved" | "deferred";

export type AnalysisSignalKind =
  | "missing-scene-purpose"
  | "missing-scene-change"
  | "missing-scene-pov"
  | "missing-scene-plotlines"
  | "scene-without-links"
  | "scene-low-texture"
  | "scene-monotony"
  | "scene-repetition-cluster"
  | "character-dropped-from-scenes"
  | "plotline-without-progression"
  | "entity-without-mentions"
  | "style-filler-words"
  | "style-space-before-punctuation"
  | "style-repeated-punctuation"
  | "open-editorial-task-without-links"
  | "open-relationship-without-links";

export interface FrontmatterBase {
  id: string;
  type: EntityType;
  title: string;
  status?: string;
  tags?: string[];
  refs?: string[];
  analysisIgnore?: string[];
  analysisSignals?: Record<string, AnalysisSignalStatus>;
  updatedAt: string;
}

export interface EntityRecord {
  frontmatter: FrontmatterBase & Record<string, unknown>;
  body: string;
  filePath: string;
}

export interface BookProjectIndex {
  projectRoot: string;
  entities: EntityRecord[];
}

export interface NormalizedSceneMeta {
  what: string;
  why: string;
  pov: string;
  change: string;
  plotlines: string[];
}

export interface NormalizedEntityRecord {
  id: string;
  type: EntityType;
  title: string;
  status: string;
  tags: string[];
  refs: string[];
  analysisIgnore: string[];
  analysisSignals: Partial<Record<AnalysisSignalKind, AnalysisSignalStatus>>;
  updatedAt: string;
  updatedAtMs: number;
  body: string;
  filePath: string;
  scene?: NormalizedSceneMeta;
}

export interface AnalysisSignal {
  id: string;
  kind: AnalysisSignalKind;
  group: AnalysisSignalGroup;
  severity: AnalysisSignalSeverity;
  status: AnalysisSignalStatus;
  entityId: string;
  filePath: string;
  title: string;
  description: string;
  suggestedAction: string;
  passes: EditorialPass[];
  relatedEntityIds: string[];
}

export interface ProjectAnalysisSummary {
  entityCount: number;
  sceneCount: number;
  signalCount: number;
  criticalCount: number;
  warningCount: number;
  infoCount: number;
}

export interface ProjectAnalysisResult {
  generatedAt: string;
  summary: ProjectAnalysisSummary;
  entities: NormalizedEntityRecord[];
  signals: AnalysisSignal[];
  passBuckets: Record<EditorialPass, AnalysisSignal[]>;
}

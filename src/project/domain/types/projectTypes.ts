export type EntityType =
  | "character"
  | "plotline"
  | "relationship"
  | "chapter"
  | "scene"
  | "editorialTask"
  | "checklist";

export interface FrontmatterBase {
  id: string;
  type: EntityType;
  title: string;
  status?: string;
  tags?: string[];
  refs?: string[];
  analysisIgnore?: string[];
  analysisSignals?: Record<string, import("../../../analysis/domain/types/analysisTypes").AnalysisSignalStatus>;
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
  analysisSignals: Partial<Record<import("../../../analysis/domain/types/analysisTypes").AnalysisSignalKind, import("../../../analysis/domain/types/analysisTypes").AnalysisSignalStatus>>;
  updatedAt: string;
  updatedAtMs: number;
  body: string;
  filePath: string;
  scene?: NormalizedSceneMeta;
}

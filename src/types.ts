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


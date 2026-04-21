export const BOOK_ROOT = "book-project";

export const PROJECT_PATHS = {
  project: `${BOOK_ROOT}/project.md`,
  schemaVersion: `${BOOK_ROOT}/.bookmeta/schema-version.md`,
  exportTypographyConfig: `${BOOK_ROOT}/.bookmeta/export-typography.json`,
  charactersDir: `${BOOK_ROOT}/characters`,
  plotlinesDir: `${BOOK_ROOT}/plotlines`,
  relationshipsDir: `${BOOK_ROOT}/relationships`,
  chaptersDir: `${BOOK_ROOT}/chapters`,
  editorialTasksDir: `${BOOK_ROOT}/editorial/tasks`,
  editorialChecklistsDir: `${BOOK_ROOT}/editorial/checklists`
} as const;

export type SupportedEntityType =
  | "character"
  | "plotline"
  | "relationship"
  | "chapter"
  | "scene"
  | "editorialTask"
  | "checklist";

export type TypographyConfig = {
  bodyFontFamily: string;
  bodyFontSizePt: number;
};

export type RenderBlock =
  | { kind: "heading"; text: string; level: number }
  | { kind: "paragraph"; text: string }
  | { kind: "listItem"; text: string; ordered: boolean; order?: number }
  | { kind: "blank" };

import { readString, readStringArray } from "./html";

export type SceneMeta = {
  what: string;
  why: string;
  pov: string;
  change: string;
  plotlines: string[];
};

export function extractSceneMeta(frontmatter: Record<string, unknown>): SceneMeta {
  return {
    what: readString(frontmatter.sceneWhat),
    why: readString(frontmatter.sceneWhy),
    pov: readString(frontmatter.scenePov),
    change: readString(frontmatter.sceneChange),
    plotlines: readStringArray(frontmatter.scenePlotlines)
  };
}

export function getMissingSceneFields(sceneMeta: SceneMeta): string[] {
  const missing: string[] = [];
  if (!sceneMeta.what.trim()) {
    missing.push("what");
  }
  if (!sceneMeta.why.trim()) {
    missing.push("why");
  }
  if (!sceneMeta.pov.trim()) {
    missing.push("pov");
  }
  if (!sceneMeta.change.trim()) {
    missing.push("change");
  }
  if (!sceneMeta.plotlines.length) {
    missing.push("plotlines");
  }
  return missing;
}

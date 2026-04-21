import type { MarkdownRepository } from "../../../storage/markdownRepository";

export async function buildOrderedManuscriptMarkdown(repository: MarkdownRepository): Promise<string> {
  const index = await repository.readIndex();
  const chapters = index.entities
    .filter((e) => e.frontmatter.type === "chapter")
    .sort((a, b) => String(a.frontmatter.id).localeCompare(String(b.frontmatter.id)));

  const scenes = index.entities
    .filter((e) => e.frontmatter.type === "scene")
    .sort((a, b) => String(a.frontmatter.id).localeCompare(String(b.frontmatter.id)));

  const lines: string[] = ["# Manuscript Export", ""];

  for (const chapter of chapters) {
    lines.push(`# ${String(chapter.frontmatter.title)}`);
    lines.push(chapter.body.trim());
    lines.push("");

    const chapterId = String(chapter.frontmatter.id);
    const chapterScenes = scenes.filter((s) => String(s.filePath).includes(`/${chapterId}/`));
    for (const scene of chapterScenes) {
      lines.push(`## ${String(scene.frontmatter.title)}`);
      lines.push(scene.body.trim());
      lines.push("");
    }
  }

  if (chapters.length === 0 && scenes.length > 0) {
    for (const scene of scenes) {
      lines.push(`## ${String(scene.frontmatter.title)}`);
      lines.push(scene.body.trim());
      lines.push("");
    }
  }

  return lines.join("\n");
}

import { GraphEdge, GraphNode } from "./graphTypes";
import { extractRelationshipEntries } from "./relationshipParser";
import { normalizeLookupKey, normalizeStatus } from "../shared/html";

export function buildRelationshipGraphData(data: string): { nodes: GraphNode[]; edges: GraphEdge[] } {
  try {
    const parsed = JSON.parse(data) as {
      entities?: Array<{
        frontmatter?: Record<string, unknown>;
        body?: string;
        filePath?: string;
      }>;
    };

    const entities = Array.isArray(parsed.entities) ? parsed.entities : [];
    const visibleTypes = new Set(["character", "plotline"]);
    const nodes: GraphNode[] = entities
      .filter((entity) => {
        const frontmatter = entity.frontmatter ?? {};
        return typeof frontmatter.type === "string" && visibleTypes.has(frontmatter.type);
      })
      .map((entity) => {
        const frontmatter = entity.frontmatter ?? {};
        const rawStatus = typeof frontmatter.status === "string" ? frontmatter.status : "todo";
        const refs = Array.isArray(frontmatter.refs)
          ? frontmatter.refs.filter((ref): ref is string => typeof ref === "string")
          : [];

        return {
          id: typeof frontmatter.id === "string" ? frontmatter.id : "unknown-id",
          title: typeof frontmatter.title === "string" ? frontmatter.title : "Untitled",
          type: typeof frontmatter.type === "string" ? frontmatter.type : "unknown",
          status: normalizeStatus(rawStatus),
          filePath: entity.filePath ?? "",
          refs
        };
      });

    const knownIds = new Set(nodes.map((node) => node.id));
    const titleToId = new Map<string, string>();
    for (const node of nodes) {
      titleToId.set(normalizeLookupKey(node.title), node.id);
    }

    const edgeDedup = new Set<string>();
    const edges: GraphEdge[] = [];

    const pushEdge = (source: string, target: string, label?: string): void => {
      if (!knownIds.has(source) || !knownIds.has(target) || source === target) {
        return;
      }

      const key = `${source}->${target}`;
      if (edgeDedup.has(key)) {
        return;
      }

      edgeDedup.add(key);
      edges.push({ source, target, label: label?.trim() || undefined });
    };

    for (const node of nodes) {
      for (const ref of node.refs) {
        pushEdge(node.id, ref);
      }
    }

    for (const entity of entities) {
      const frontmatter = entity.frontmatter ?? {};
      if (frontmatter.type !== "character") {
        continue;
      }

      const sourceId = typeof frontmatter.id === "string" ? frontmatter.id : "";
      if (!sourceId || !knownIds.has(sourceId)) {
        continue;
      }

      for (const relation of extractRelationshipEntries(entity.body ?? "", knownIds, titleToId)) {
        pushEdge(sourceId, relation.targetId, relation.label);
      }
    }

    return { nodes, edges };
  } catch {
    return { nodes: [], edges: [] };
  }
}

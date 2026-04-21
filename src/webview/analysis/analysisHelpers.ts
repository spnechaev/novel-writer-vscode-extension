import { AnalysisSignal, AnalysisSignalKind, AnalysisSignalStatus, EditorialPass } from "../../analysis/domain/types/analysisTypes";
import { SignalCard } from "./analysisViewTypes";

export function normalizeSignalCard(signal: Partial<AnalysisSignal>): SignalCard {
  const severity = signal.severity === "critical" || signal.severity === "warning" || signal.severity === "info"
    ? signal.severity
    : "info";
  const status = signal.status === "ignored" || signal.status === "resolved" || signal.status === "deferred" || signal.status === "open"
    ? signal.status
    : "open";

  return {
    id: typeof signal.id === "string" ? signal.id : "unknown-signal",
    kind: isAnalysisSignalKind(signal.kind) ? signal.kind : "scene-without-links",
    group: typeof signal.group === "string" ? signal.group : "forgotten",
    severity,
    status,
    entityId: typeof signal.entityId === "string" ? signal.entityId : "unknown-entity",
    filePath: typeof signal.filePath === "string" ? signal.filePath : "",
    title: typeof signal.title === "string" ? signal.title : "Сигнал без заголовка",
    description: typeof signal.description === "string" ? signal.description : "",
    suggestedAction: typeof signal.suggestedAction === "string" ? signal.suggestedAction : "",
    passes: Array.isArray(signal.passes)
      ? signal.passes.filter(
        (pass): pass is EditorialPass => pass === "logic" || pass === "rhythm" || pass === "style" || pass === "texture" || pass === "repetition"
      )
      : [],
    relatedEntityIds: Array.isArray(signal.relatedEntityIds)
      ? signal.relatedEntityIds.filter((id): id is string => typeof id === "string")
      : []
  };
}

export function countSignals(signals: SignalCard[], group: string): number {
  return signals.filter((signal) => signal.group === group).length;
}

export function countSignalsByPass(signals: SignalCard[], pass: EditorialPass): number {
  return signals.filter((signal) => signal.passes.includes(pass)).length;
}

export function isAnalysisSignalStatus(value: string | undefined): value is AnalysisSignalStatus {
  return value === "open" || value === "ignored" || value === "resolved" || value === "deferred";
}

export function isAnalysisSignalKind(value: unknown): value is AnalysisSignalKind {
  return value === "missing-scene-purpose"
    || value === "missing-scene-change"
    || value === "missing-scene-pov"
    || value === "missing-scene-plotlines"
    || value === "scene-without-links"
    || value === "scene-low-texture"
    || value === "scene-monotony"
    || value === "scene-repetition-cluster"
    || value === "character-dropped-from-scenes"
    || value === "plotline-without-progression"
    || value === "entity-without-mentions"
    || value === "style-filler-words"
    || value === "style-space-before-punctuation"
    || value === "style-repeated-punctuation"
    || value === "open-editorial-task-without-links"
    || value === "open-relationship-without-links";
}

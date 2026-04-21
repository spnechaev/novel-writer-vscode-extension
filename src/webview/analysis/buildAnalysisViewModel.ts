import { ProjectAnalysisResult } from "../../types";
import { countSignals, countSignalsByPass, normalizeSignalCard } from "./analysisHelpers";
import { AnalysisViewModel } from "./analysisViewTypes";

const EMPTY_TABS: AnalysisViewModel["tabs"] = [
  { id: "forgotten", label: "Что забыто", count: 0 },
  { id: "looseEnd", label: "Незакрытые хвосты", count: 0 },
  { id: "logic", label: "Проход: логика", count: 0 },
  { id: "rhythm", label: "Проход: ритм", count: 0 },
  { id: "style", label: "Проход: стиль", count: 0 },
  { id: "texture", label: "Проход: фактура", count: 0 },
  { id: "repetition", label: "Проход: повторы", count: 0 }
];

export function buildAnalysisViewModel(data: string): AnalysisViewModel {
  try {
    const parsed = JSON.parse(data) as Partial<ProjectAnalysisResult>;
    const signals = Array.isArray(parsed.signals) ? parsed.signals.map((signal) => normalizeSignalCard(signal)) : [];

    return {
      generatedAt: typeof parsed.generatedAt === "string" ? parsed.generatedAt : "",
      summary: {
        entityCount: typeof parsed.summary?.entityCount === "number" ? parsed.summary.entityCount : 0,
        sceneCount: typeof parsed.summary?.sceneCount === "number" ? parsed.summary.sceneCount : 0,
        signalCount: typeof parsed.summary?.signalCount === "number" ? parsed.summary.signalCount : signals.length,
        criticalCount: typeof parsed.summary?.criticalCount === "number" ? parsed.summary.criticalCount : signals.filter((signal) => signal.severity === "critical").length,
        warningCount: typeof parsed.summary?.warningCount === "number" ? parsed.summary.warningCount : signals.filter((signal) => signal.severity === "warning").length,
        infoCount: typeof parsed.summary?.infoCount === "number" ? parsed.summary.infoCount : signals.filter((signal) => signal.severity === "info").length
      },
      tabs: [
        { id: "forgotten", label: "Что забыто", count: countSignals(signals, "forgotten") },
        { id: "looseEnd", label: "Незакрытые хвосты", count: countSignals(signals, "looseEnd") },
        { id: "logic", label: "Проход: логика", count: countSignalsByPass(signals, "logic") },
        { id: "rhythm", label: "Проход: ритм", count: countSignalsByPass(signals, "rhythm") },
        { id: "style", label: "Проход: стиль", count: countSignalsByPass(signals, "style") },
        { id: "texture", label: "Проход: фактура", count: countSignalsByPass(signals, "texture") },
        { id: "repetition", label: "Проход: повторы", count: countSignalsByPass(signals, "repetition") }
      ],
      signals
    };
  } catch {
    return {
      generatedAt: "",
      summary: {
        entityCount: 0,
        sceneCount: 0,
        signalCount: 0,
        criticalCount: 0,
        warningCount: 0,
        infoCount: 0
      },
      tabs: EMPTY_TABS,
      signals: []
    };
  }
}

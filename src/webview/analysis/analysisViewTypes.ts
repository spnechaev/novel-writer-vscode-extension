import { AnalysisSignalKind, AnalysisSignalSeverity, AnalysisSignalStatus, EditorialPass } from "../../types";

export type AnalysisTabId = "forgotten" | "looseEnd" | EditorialPass;

export type AnalysisTab = {
  id: AnalysisTabId;
  label: string;
  count: number;
};

export type SignalCard = {
  id: string;
  kind: AnalysisSignalKind;
  group: string;
  severity: AnalysisSignalSeverity;
  status: AnalysisSignalStatus;
  entityId: string;
  filePath: string;
  title: string;
  description: string;
  suggestedAction: string;
  passes: EditorialPass[];
  relatedEntityIds: string[];
};

export type AnalysisViewModel = {
  generatedAt: string;
  summary: {
    entityCount: number;
    sceneCount: number;
    signalCount: number;
    criticalCount: number;
    warningCount: number;
    infoCount: number;
  };
  tabs: AnalysisTab[];
  signals: SignalCard[];
};

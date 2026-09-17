export type AnalysisKind = "reformulation" | "rescue";
export type AnalysisStatus = "Completed" | "No candidates";

export type SessionAnalysis = {
  id: string;
  kind: AnalysisKind;
  title: string;
  summary: string;
  createdAt: string;
  status: AnalysisStatus;
  insight: string;
  payload: unknown;
  pinned: boolean;
};

export type NewSessionAnalysis = Omit<SessionAnalysis, "id" | "createdAt" | "pinned">;

export type GraphNode = {
  id: string;
  title: string;
  type: string;
  status: string;
  filePath: string;
  refs: string[];
};

export type GraphEdge = {
  source: string;
  target: string;
  label?: string;
};

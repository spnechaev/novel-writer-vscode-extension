import { SceneMeta } from "../shared/sceneMeta";

export type BoardCard = {
  id: string;
  title: string;
  type: string;
  status: string;
  filePath: string;
  tags: string[];
  sceneMeta?: SceneMeta;
  missingSceneFields?: string[];
};

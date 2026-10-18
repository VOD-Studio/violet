import { apiPost } from "@shared/api/request";
import type { RoadmapMoveInput } from "../lib/roadmap-move";
import type { RoadmapItem } from "../model/roadmap";

export const moveRoadmapItem = (projectId: string, itemId: string, input: RoadmapMoveInput) =>
	apiPost<RoadmapItem>(`/admin/projects/${projectId}/roadmap/items/${itemId}/move`, input);

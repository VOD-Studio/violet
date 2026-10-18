import { apiDelete, apiPost, apiPut } from "@shared/api/request";
import type { RoadmapContentInput } from "../lib/roadmap-content";
import type { RoadmapMoveInput } from "../lib/roadmap-move";
import type { RoadmapItem, RoadmapStage } from "../model/roadmap";

const items = (projectId: string) => `/admin/projects/${projectId}/roadmap/items`;

export const moveRoadmapItem = (projectId: string, itemId: string, input: RoadmapMoveInput) =>
	apiPost<RoadmapItem>(`${items(projectId)}/${itemId}/move`, input);

/** 新条目追加到所在阶段末尾；进入已完成时完成日期取后端当天。 */
export const createRoadmapItem = (
	projectId: string,
	input: { title: string; stage: RoadmapStage },
) => apiPost<RoadmapItem>(items(projectId), input);

/** 整体替换内容；没给完成日期时后端保留原值。 */
export const updateRoadmapItem = (projectId: string, itemId: string, input: RoadmapContentInput) =>
	apiPut<RoadmapItem>(`${items(projectId)}/${itemId}`, input);

/** 软删除；编号、位置、内容与关系保留，恢复后原样回来。 */
export const deleteRoadmapItem = (projectId: string, itemId: string) =>
	apiDelete<void>(`${items(projectId)}/${itemId}`);

export const restoreRoadmapItem = (projectId: string, itemId: string) =>
	apiPost<RoadmapItem>(`${items(projectId)}/${itemId}/restore`);

import { apiPost } from "@shared/api/request";
import { useQueryClient } from "@tanstack/react-query";
import type { BoardMove } from "@violetjs/kanban/core";
import { useCallback } from "react";
import { applyMovedItem, type RoadmapMoveInput, toMoveInput } from "../lib/roadmap-move";
import type { RoadmapDetail, RoadmapItem } from "../model/roadmap";
import { projectKeys } from "./keys";

export const moveRoadmapItem = (projectId: string, itemId: string, input: RoadmapMoveInput) =>
	apiPost<RoadmapItem>(`/admin/projects/${projectId}/roadmap/items/${itemId}/move`, input);

/**
 * 保存看板上的一次移动。
 *
 * 看板在保存完成前先按新位置显示；成功后把接口返回的条目写进路线图缓存（完成日期、交付版本以它为准），
 * 再在后台重新拉取，更新被阻塞标记与项目列表的进度摘要。失败时抛出，看板据此回滚并提示。
 *
 * @param slug 项目 slug，路线图缓存的键
 * @param projectId 项目 ID，移动接口的路径参数
 */
export function useMoveRoadmapItem(slug: string, projectId: string) {
	const queryClient = useQueryClient();
	return useCallback(
		async (move: BoardMove) => {
			const moved = await moveRoadmapItem(projectId, move.cardId, toMoveInput(move));
			const key = projectKeys.roadmap(slug);
			queryClient.setQueryData<RoadmapDetail>(key, (detail) =>
				detail ? applyMovedItem(detail, moved) : detail,
			);
			void queryClient.invalidateQueries({ queryKey: key, exact: true });
			void queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
		},
		[queryClient, projectId, slug],
	);
}

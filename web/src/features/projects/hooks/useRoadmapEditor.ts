import { useQueryClient } from "@tanstack/react-query";
import {
	type BoardMove,
	type CommandHistory,
	createHistory,
	invertMove,
} from "@violetjs/kanban/core";
import { useMemo, useRef } from "react";
import { toast } from "sonner";
import { projectKeys } from "../api/keys";
import { moveRoadmapItem } from "../api/mutations";
import {
	applyMovedItem,
	keepCompletion,
	type RoadmapMoveInput,
	toMoveInput,
} from "../lib/roadmap-move";
import type { RoadmapDetail, RoadmapItem } from "../model/roadmap";

export interface RoadmapEditor {
	/** 本页会话内的撤销重做历史；每一步撤销与重做都是一次真实的保存。 */
	history: CommandHistory;
	/** 保存看板上的一次移动并记入历史；失败时抛出，看板据此回滚并提示。 */
	move: (move: BoardMove) => Promise<void>;
}

/**
 * 管理员编辑路线图：保存、写回缓存与撤销重做。
 *
 * 保存成功后把接口返回的条目写进路线图缓存（以它为准对账），再在后台重新拉取，
 * 更新被阻塞标记与项目列表的进度摘要。
 *
 * @param slug 项目 slug，路线图缓存的键
 * @param detail 当前的路线图；撤销所需的「之前的样子」从这里取
 */
export function useRoadmapEditor(slug: string, detail: RoadmapDetail | undefined): RoadmapEditor {
	const queryClient = useQueryClient();
	const latest = useRef(detail);
	latest.current = detail;
	const history = useMemo(
		() =>
			createHistory({
				onError: (_error, command) =>
					toast.error(`「${command.label ?? "这一步"}」未能完成，已从撤销记录中移除`),
			}),
		[],
	);

	return useMemo(() => {
		const key = projectKeys.roadmap(slug);
		const projectId = () => latest.current?.project.id ?? "";
		const settle = (item: RoadmapItem) => {
			queryClient.setQueryData<RoadmapDetail>(key, (current) =>
				current ? applyMovedItem(current, item) : current,
			);
			void queryClient.invalidateQueries({ queryKey: key, exact: true });
			void queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
		};
		const persistMove = async (itemId: string, input: RoadmapMoveInput) => {
			settle(await moveRoadmapItem(projectId(), itemId, input));
		};

		const move = async (boardMove: BoardMove) => {
			const before = latest.current?.items.find((item) => item.id === boardMove.cardId);
			const moved = await moveRoadmapItem(
				projectId(),
				boardMove.cardId,
				toMoveInput(boardMove),
			);
			settle(moved);
			const back = toMoveInput(invertMove(boardMove));
			// 撤销回到已完成时带回原来的完成日期与版本；重做再进已完成时沿用这次保存的日期
			const undoInput = before ? keepCompletion(back, before) : back;
			const redoInput = keepCompletion(toMoveInput(boardMove), moved);
			history.push({
				label: `移动 #${moved.number}`,
				undo: () => persistMove(moved.id, undoInput),
				redo: () => persistMove(moved.id, redoInput),
			});
		};

		return { history, move };
	}, [history, queryClient, slug]);
}

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
import {
	createRoadmapItem,
	deleteRoadmapItem,
	moveRoadmapItem,
	restoreRoadmapItem,
	updateRoadmapItem,
} from "../api/mutations";
import { contentOf, type RoadmapContentInput } from "../lib/roadmap-content";
import {
	keepCompletion,
	type RoadmapMoveInput,
	removeItem,
	toMoveInput,
	upsertItem,
} from "../lib/roadmap-move";
import type { RoadmapDetail, RoadmapItem, RoadmapStage } from "../model/roadmap";

export interface RoadmapEditor {
	/** 本页会话内的撤销重做历史；每一步撤销与重做都是一次真实的保存。 */
	history: CommandHistory;
	/** 保存看板上的一次移动并记入历史；失败时抛出，看板据此回滚并提示。 */
	move: (move: BoardMove) => Promise<void>;
	/** 在某个阶段末尾新建只有标题的条目并记入历史；失败时抛出，看板保留草稿并提示。 */
	add: (card: { columnId: string; title: string }) => Promise<void>;
	/** 只改标题；其余内容照旧整体提交。失败时抛出，编辑框留着草稿并提示。 */
	rename: (item: RoadmapItem, title: string) => Promise<void>;
	/** 整体保存条目内容并记入历史；失败时抛出，表单留着草稿并显示原因。 */
	save: (item: RoadmapItem, content: RoadmapContentInput) => Promise<void>;
	/**
	 * 删除条目（不确认），记入历史并弹出带「撤销」的提示；撤销恢复同一个条目。
	 * 失败时抛出，条目留在原处。
	 */
	remove: (item: RoadmapItem) => Promise<void>;
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
				current ? upsertItem(current, item) : current,
			);
			void queryClient.invalidateQueries({ queryKey: key, exact: true });
			void queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
		};
		const persistMove = async (itemId: string, input: RoadmapMoveInput) => {
			settle(await moveRoadmapItem(projectId(), itemId, input));
		};
		const persistDelete = async (itemId: string) => {
			await deleteRoadmapItem(projectId(), itemId);
			queryClient.setQueryData<RoadmapDetail>(key, (current) =>
				current ? removeItem(current, itemId) : current,
			);
			void queryClient.invalidateQueries({ queryKey: key, exact: true });
			void queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
		};
		const persistRestore = async (itemId: string) => {
			settle(await restoreRoadmapItem(projectId(), itemId));
		};
		const persistUpdate = async (itemId: string, content: RoadmapContentInput) => {
			settle(await updateRoadmapItem(projectId(), itemId, content));
		};
		// 编辑是整体替换：撤销时用编辑之前的内容再整体提交一次
		const update = async (item: RoadmapItem, next: RoadmapContentInput, label: string) => {
			const previous = contentOf(item);
			await persistUpdate(item.id, next);
			history.push({
				label,
				undo: () => persistUpdate(item.id, previous),
				redo: () => persistUpdate(item.id, next),
			});
		};
		const rename = (item: RoadmapItem, title: string) =>
			update(item, { ...contentOf(item), title }, `重命名 #${item.number}`);

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

		// 撤销新建就是删除；重做是恢复同一个条目（同编号、同位置），而不是再建一个
		const add = async ({ columnId, title }: { columnId: string; title: string }) => {
			const created = await createRoadmapItem(projectId(), {
				title,
				stage: columnId as RoadmapStage,
			});
			settle(created);
			history.push({
				label: `新增 #${created.number}`,
				undo: () => persistDelete(created.id),
				redo: () => persistRestore(created.id),
			});
		};

		const save = (item: RoadmapItem, content: RoadmapContentInput) =>
			update(item, content, `编辑 #${item.number}`);

		const remove = async (item: RoadmapItem) => {
			await persistDelete(item.id);
			history.push({
				label: `删除 #${item.number}`,
				undo: () => persistRestore(item.id),
				redo: () => persistDelete(item.id),
			});
			// 提示里的「撤销」撤的是历史里最近一步，也就是这次删除
			toast(`已删除 #${item.number} ${item.title}`, {
				action: { label: "撤销", onClick: () => void history.undo() },
			});
		};

		return { history, move, add, rename, save, remove };
	}, [history, queryClient, slug]);
}

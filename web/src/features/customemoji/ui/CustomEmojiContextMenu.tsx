import {
	useDeleteCustomEmoji,
	useFavoriteCustomEmoji,
	useUnfavoriteCustomEmoji,
} from "@features/customemoji/api/queries";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@violet/ui";

import { BookmarkMinus, BookmarkPlus, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";

interface CustomEmojiTarget {
	id: string;
	relation: "owned" | "favorited" | "none";
}

/**
 * 目标在自己的 ContextMenu 触发区内（如列表行上的行菜单）：事件留给那个菜单。
 * 它打开时会 preventDefault，外层 Radix 触发器随之跳过，不会同时弹出两个菜单。
 *
 * 用最近的触发器是否就是外层这个来判断，而不是 DOM 包含关系：
 * Portal 渲染（如陈列室的走近检视台）的内容不在这个 DOM 子树里，但 React 事件仍会穿过来。
 */
function insideNestedContextMenu(event: React.MouseEvent<HTMLDivElement>) {
	if (!(event.target instanceof Element)) return false;
	const selector = '[data-slot="context-menu-trigger"]';
	const nearest = event.target.closest(selector);
	return nearest !== null && nearest !== event.currentTarget.closest(selector);
}

/**
 * 全局自定义表情右键菜单：只有带 data-custom-emoji-id 的图片拦截浏览器菜单。
 *
 * 系统表情与普通内容在捕获阶段停止冒泡但不阻止默认行为，继续使用浏览器原生菜单；
 * 页面里自带 ContextMenu 的区域例外，事件照常交给它。
 */
export function CustomEmojiContextMenu({ children }: { children: ReactNode }) {
	const [target, setTarget] = useState<CustomEmojiTarget | null>(null);
	const favorite = useFavoriteCustomEmoji();
	const unfavorite = useUnfavoriteCustomEmoji();
	const remove = useDeleteCustomEmoji();
	const busy = favorite.isPending || unfavorite.isPending || remove.isPending;

	const handleContextMenuCapture = (event: React.MouseEvent<HTMLDivElement>) => {
		const eventTarget = event.target;
		const image =
			eventTarget instanceof Element
				? eventTarget.closest<HTMLImageElement>("img[data-custom-emoji-id]")
				: null;
		if (!image || !event.currentTarget.contains(image)) {
			if (!insideNestedContextMenu(event)) event.stopPropagation();
			setTarget(null);
			return;
		}

		const id = image.dataset.customEmojiId;
		if (!id) {
			event.stopPropagation();
			setTarget(null);
			return;
		}
		const relation = image.dataset.relation;
		setTarget({
			id,
			relation: relation === "owned" || relation === "favorited" ? relation : "none",
		});
	};

	const handleOpenChange = (open: boolean) => {
		if (!open) setTarget(null);
	};

	const handleSelect = () => {
		if (!target || busy) return;
		switch (target.relation) {
			case "owned":
				remove.mutate(target.id);
				break;
			case "favorited":
				unfavorite.mutate(target.id);
				break;
			default:
				favorite.mutate(target.id);
		}
		setTarget(null);
	};

	return (
		<ContextMenu open={target !== null} onOpenChange={handleOpenChange}>
			<ContextMenuTrigger asChild>
				<div className="contents">
					<div className="contents" onContextMenuCapture={handleContextMenuCapture}>
						{children}
					</div>
				</div>
			</ContextMenuTrigger>
			{target && (
				<ContextMenuContent>
					<ContextMenuItem
						disabled={busy}
						variant={target.relation === "owned" ? "destructive" : "default"}
						onSelect={handleSelect}
					>
						{target.relation === "owned" ? (
							<Trash2 />
						) : target.relation === "favorited" ? (
							<BookmarkMinus />
						) : (
							<BookmarkPlus />
						)}
						{target.relation === "owned"
							? "删除表情"
							: target.relation === "favorited"
								? "移出我的表情"
								: "收藏到我的表情"}
					</ContextMenuItem>
				</ContextMenuContent>
			)}
		</ContextMenu>
	);
}

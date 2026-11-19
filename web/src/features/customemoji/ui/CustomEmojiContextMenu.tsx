import {
	useDeleteCustomEmoji,
	useFavoriteCustomEmoji,
	useUnfavoriteCustomEmoji,
} from "@features/customemoji/api/queries";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@violet/ui";

import { BookmarkMinus, BookmarkPlus, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { useRef, useState } from "react";

interface CustomEmojiTarget {
	id: string;
	relation: "owned" | "favorited" | "none";
}

/**
 * 全局自定义表情右键菜单：只有带 data-custom-emoji-id 的图片拦截浏览器菜单。
 *
 * 普通内容保留浏览器原生菜单；内层菜单优先处理自己的右键事件。
 */
export function CustomEmojiContextMenu({ children }: { children: ReactNode }) {
	const [target, setTarget] = useState<CustomEmojiTarget | null>(null);
	const triggerRef = useRef<HTMLSpanElement>(null);
	const favorite = useFavoriteCustomEmoji();
	const unfavorite = useUnfavoriteCustomEmoji();
	const remove = useDeleteCustomEmoji();
	const busy = favorite.isPending || unfavorite.isPending || remove.isPending;

	const handleContextMenu = (event: React.MouseEvent<HTMLDivElement>) => {
		if (event.defaultPrevented) return;
		const eventTarget = event.target;
		const image =
			eventTarget instanceof Element
				? (eventTarget.closest<HTMLImageElement>("img[data-custom-emoji-id]") ??
					eventTarget
						.closest("button")
						?.querySelector<HTMLImageElement>("img[data-custom-emoji-id]"))
				: null;
		const id = image?.dataset.customEmojiId;
		const trigger = triggerRef.current;
		if (!image || !id || !trigger || !event.currentTarget.contains(image)) {
			setTarget(null);
			return;
		}

		const relation = image.dataset.relation;
		event.preventDefault();
		setTarget({
			id,
			relation: relation === "owned" || relation === "favorited" ? relation : "none",
		});
		trigger.dispatchEvent(
			new MouseEvent("contextmenu", {
				bubbles: true,
				cancelable: true,
				clientX: event.clientX,
				clientY: event.clientY,
			}),
		);
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
		<>
			<div className="contents" onContextMenu={handleContextMenu}>
				{children}
			</div>
			{/* Radix 定位状态只属于菜单，不应触发仍在水合的页面内容更新。 */}
			<ContextMenu open={target !== null} onOpenChange={handleOpenChange}>
				<ContextMenuTrigger ref={triggerRef} hidden />
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
		</>
	);
}

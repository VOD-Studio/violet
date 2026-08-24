import {
	useDeleteCustomEmoji,
	useFavoriteCustomEmoji,
	useUnfavoriteCustomEmoji,
} from "@features/customemoji/api/queries";
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuTrigger,
} from "@shared/ui/base/context-menu";
import { BookmarkMinus, BookmarkPlus, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";

interface CustomEmojiTarget {
	id: string;
	relation: "owned" | "favorited" | "none";
}

/**
 * 全局自定义表情右键菜单：只有带 data-custom-emoji-id 的图片拦截浏览器菜单。
 *
 * 系统表情与普通内容在捕获阶段停止冒泡但不阻止默认行为，继续使用浏览器原生菜单。
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
			event.stopPropagation();
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

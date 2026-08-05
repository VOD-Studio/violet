/**
 * ReactionBar - 评论表情反应条
 *
 * 展示某条评论的聚合表情计数，支持登录用户添加/取消反应。
 * 匿名态仅展示（评论区黑洞模式下本组件不会出现在匿名视图）。
 */
import type { Emoji } from "@entities/emoji/model/types";
import { useAddReaction, useRemoveReaction } from "@features/comments/api/mutations";
import { EmojiPicker } from "@features/emojis/ui/EmojiPicker";
import { isImageURL } from "@shared/lib/url";
import { Button } from "@shared/ui/base/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@shared/ui/base/tooltip";
import { Loader2, Smile } from "lucide-react";
import { useMemo } from "react";
import type { Reaction } from "../model/types";
import { useReactionsFromContext } from "./ReactionProvider";

export interface ReactionBarProps {
	/** 评论 ID */
	commentId: string;
	/** 是否登录 */
	isLoggedIn?: boolean;
}

/** ReactionBar - 评论表情反应条 */
export function ReactionBar({ commentId, isLoggedIn = false }: ReactionBarProps) {
	const { reactions: rawReactions, isLoading } = useReactionsFromContext(commentId);
	// 防御后端 nil slice 序列化为 null 等非法场景
	const reactions = Array.isArray(rawReactions) ? rawReactions : [];
	const selfReactionIds = useSelfReactionIds(reactions);

	const { mutate: addReaction, isPending: isAdding } = useAddReaction(commentId);
	const { mutate: removeReaction, isPending: isRemoving } = useRemoveReaction(commentId);
	const isBusy = isAdding || isRemoving;

	const handleToggle = (emojiId: number) => {
		if (!isLoggedIn || isBusy) return;
		const isSelf = selfReactionIds.has(emojiId);
		if (isSelf) {
			removeReaction(emojiId);
		} else {
			addReaction({ emoji_id: emojiId });
		}
	};

	const handleAdd = (emoji: Emoji) => {
		if (!isLoggedIn || isBusy) return;
		if (selfReactionIds.has(emoji.id)) return;
		addReaction({ emoji_id: emoji.id });
	};

	if (isLoading) {
		return (
			<div className="flex items-center gap-1 text-xs text-muted-foreground">
				<Loader2 className="size-3 animate-spin" />
				加载表情…
			</div>
		);
	}

	return (
		<TooltipProvider delayDuration={200}>
			<div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
				{isLoggedIn && (
					<EmojiPicker
						align="start"
						selectedIds={selfReactionIds}
						onSelect={handleAdd}
						trigger={
							<Button
								type="button"
								variant="ghost"
								size="icon-xs"
								aria-label="添加表情"
								disabled={isBusy}
								className="text-muted-foreground hover:text-foreground disabled:opacity-50"
							>
								<Smile className="size-3.5" />
							</Button>
						}
					/>
				)}

				{reactions.map((reaction) => {
					const isSelf = !!reaction.self;
					const emojiUrl = reaction.gif_url || reaction.emoji_url;
					return (
						<Tooltip key={reaction.emoji_id}>
							<TooltipTrigger asChild>
								<button
									type="button"
									onClick={() => handleToggle(reaction.emoji_id)}
									disabled={!isLoggedIn || isBusy}
									aria-pressed={isSelf}
									className={reactionChipClass(isSelf)}
								>
									{isImageURL(emojiUrl) ? (
										<img
											src={emojiUrl}
											alt={reaction.emoji_name}
											className="size-4 object-contain"
											loading="lazy"
										/>
									) : (
										<span className="max-w-16 truncate text-xs leading-none">
											{reaction.emoji_name}
										</span>
									)}
									<span className="min-w-[1ch] tabular-nums">
										{formatReactionCount(reaction.count)}
									</span>
								</button>
							</TooltipTrigger>
							<TooltipContent side="bottom" sideOffset={4}>
								<p className="text-xs">{reaction.emoji_name}</p>
							</TooltipContent>
						</Tooltip>
					);
				})}
			</div>
		</TooltipProvider>
	);
}

/** 根据是否已反应返回 chip 样式 */
function reactionChipClass(isSelf: boolean): string {
	const base =
		"inline-flex h-6 items-center gap-1 rounded-full border px-2 text-xs transition-colors";
	return isSelf
		? `${base} border-primary bg-primary/10 text-primary hover:bg-primary/20`
		: `${base} border-edge-hairline bg-muted/40 text-foreground hover:bg-muted`;
}

/** formatReactionCount - 反应计数格式化，超过 99 显示 99+ */
function formatReactionCount(count: number): string {
	return count > 99 ? "99+" : String(count);
}

/**
 * useSelfReactionIds - 计算当前用户已反应的表情 ID 集合
 *
 * 聚合读模型中每个 Reaction 已携带 self 标记，直接从中提取即可。
 */
function useSelfReactionIds(reactions: Reaction[]): Set<number> {
	return useMemo(() => {
		const set = new Set<number>();
		for (const r of reactions) {
			if (r.self) {
				set.add(r.emoji_id);
			}
		}
		return set;
	}, [reactions]);
}

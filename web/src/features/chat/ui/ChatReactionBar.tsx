import { isImageURL } from "@shared/lib/url";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@shared/ui/base/tooltip";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import type { ChatMessageReaction } from "../model/types";

const visibleReactionLimit = 6;

/**
 * 聊天消息的聚合 reaction 展示条。
 *
 * @param reactions 当前消息的聚合 reaction
 * @param onToggle 点击 reaction 胶囊时的切换回调
 * @param disabled 是否暂时禁止切换
 */
export interface ChatReactionBarProps {
	reactions: ChatMessageReaction[];
	onToggle: (emojiID: number) => void;
	disabled?: boolean;
}

/** 聊天消息 reaction 展示条。 */
export function ChatReactionBar({ reactions, onToggle, disabled = false }: ChatReactionBarProps) {
	const [expanded, setExpanded] = useState(false);
	if (reactions.length === 0) return null;

	const visibleReactions = expanded ? reactions : reactions.slice(0, visibleReactionLimit);
	const hiddenCount = reactions.length - visibleReactions.length;

	return (
		<TooltipProvider delayDuration={200}>
			<div className="flex flex-wrap items-center gap-1.5 pt-1">
				{visibleReactions.map((reaction) => {
					const emojiURL =
						reaction.gif_url.length > 0 ? reaction.gif_url : reaction.emoji_url;
					return (
						<Tooltip key={reaction.emoji_id}>
							<TooltipTrigger asChild>
								<button
									aria-pressed={reaction.self}
									className={reactionChipClass(reaction.self)}
									disabled={disabled}
									onClick={() => onToggle(reaction.emoji_id)}
									type="button"
								>
									{isImageURL(emojiURL) ? (
										<img
											alt={reaction.emoji_name}
											className="size-4 object-contain"
											loading="lazy"
											src={emojiURL}
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
				{hiddenCount > 0 && (
					<button
						aria-expanded={expanded}
						aria-label={`展开其余 ${hiddenCount} 个表情`}
						className="inline-flex h-6 items-center gap-0.5 rounded-full border border-dashed border-edge-hairline px-2 text-xs text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground"
						onClick={() => setExpanded(true)}
						type="button"
					>
						<span>+{hiddenCount}</span>
						<ChevronDown className="size-3" />
					</button>
				)}
				{expanded && reactions.length > visibleReactionLimit && (
					<button
						aria-expanded="true"
						aria-label="收起表情"
						className="inline-flex h-6 items-center rounded-full border border-dashed border-edge-hairline px-2 text-xs text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground"
						onClick={() => setExpanded(false)}
						type="button"
					>
						<ChevronUp className="size-3" />
					</button>
				)}
			</div>
		</TooltipProvider>
	);
}

function reactionChipClass(isSelf: boolean): string {
	const base =
		"inline-flex h-6 items-center gap-1 rounded-full border px-2 text-xs transition-colors disabled:opacity-60";
	return isSelf
		? `${base} border-primary bg-primary/10 text-primary hover:bg-primary/20`
		: `${base} border-edge-hairline bg-muted/40 text-foreground hover:bg-muted`;
}

function formatReactionCount(count: number): string {
	return count > 99 ? "99+" : String(count);
}

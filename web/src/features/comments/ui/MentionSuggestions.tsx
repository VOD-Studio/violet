/**
 * @ 提及候选浮层：受控高亮项，并负责把高亮项滚进可视区。
 *
 * 筛选与按键消费留在 RichCommentInput——只有它拿得到 contentEditable 的光标态，
 * 浮层自己无从判断「当前查询词是什么」。
 */
import { cn } from "@shared/lib/utils";
import { useEffect, useRef } from "react";

export interface MentionCandidate {
	/** 用户 ID，写进提及占位符的 userID 段 */
	id: string;
	/** 用户名，写进提及占位符的 username 段，兼作筛选字段 */
	username: string;
	/** 展示名，用于候选项与输入框内提及药丸的可见文本 */
	displayName: string;
	avatarUrl?: string;
}

interface MentionSuggestionsProps {
	candidates: MentionCandidate[];
	/** 高亮项下标，由键盘导航驱动 */
	activeIndex: number;
	onSelect: (candidate: MentionCandidate) => void;
	onActiveIndexChange: (index: number) => void;
}

export function MentionSuggestions({
	candidates,
	activeIndex,
	onSelect,
	onActiveIndexChange,
}: MentionSuggestionsProps) {
	const listRef = useRef<HTMLDivElement>(null);
	/**
	 * hover 选中许可：滚动高亮项后置否，鼠标真实移动（mousemove）时恢复。
	 * 否则静止鼠标下的列表滚动会合成 mouseEnter，把方向键选中劫回鼠标悬停项。
	 */
	const allowHover = useRef(true);

	useEffect(() => {
		allowHover.current = false;
		listRef.current
			?.querySelectorAll('[role="option"]')
			[activeIndex]?.scrollIntoView({ block: "nearest" });
	}, [activeIndex]);

	return (
		<div
			aria-label="提及候选"
			// scroll-py 让 block:"nearest" 停在容器内边距内侧，高亮项不贴边
			className="absolute bottom-full left-0 z-20 mb-2 max-h-56 w-64 overflow-y-auto scroll-py-1 rounded-xl border border-edge-hairline bg-popover p-1 shadow-lg"
			onMouseMove={() => {
				allowHover.current = true;
			}}
			ref={listRef}
			role="listbox"
		>
			{candidates.map((candidate, index) => (
				<button
					aria-selected={index === activeIndex}
					className={cn(
						"flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors",
						index === activeIndex ? "bg-accent" : "hover:bg-accent/60",
					)}
					key={candidate.id}
					onClick={() => onSelect(candidate)}
					// 点击候选项会先让编辑区失焦，浮层随即关闭、click 打不到——按下时就拦住失焦。
					onMouseDown={(event) => event.preventDefault()}
					onMouseEnter={() => {
						if (allowHover.current) onActiveIndexChange(index);
					}}
					role="option"
					type="button"
				>
					{candidate.avatarUrl ? (
						<img
							alt=""
							className="size-6 shrink-0 rounded-full object-cover"
							src={candidate.avatarUrl}
						/>
					) : (
						<span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-secondary text-xs text-muted-foreground">
							{candidate.displayName.slice(0, 1)}
						</span>
					)}
					<span className="min-w-0 flex-1">
						<span className="block truncate text-sm text-foreground">
							{candidate.displayName}
						</span>
						<span className="block truncate font-mono text-[11px] text-muted-foreground">
							@{candidate.username}
						</span>
					</span>
				</button>
			))}
		</div>
	);
}

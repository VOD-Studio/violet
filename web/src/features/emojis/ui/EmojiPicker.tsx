import type { Emoji } from "@entities/emoji/model/types";
import { useAllEmojis } from "@features/emojis/api/queries";
import styles from "@features/emojis/ui/EmojiPicker.module.css";
import { EmojiTile } from "@features/emojis/ui/EmojiTile";
import { MyEmojisPanel } from "@features/emojis/ui/MyEmojisPanel";
import { useSessionStore } from "@shared/api/session";
import { isImageURL } from "@shared/lib/url";
import {
	Button,
	Popover,
	PopoverContent,
	PopoverTrigger,
	ScrollArea,
	TooltipProvider,
} from "@violet/ui";
import { cn } from "cn";
import { ChevronLeft, ChevronRight, Heart, Loader2, Smile } from "lucide-react";
import { type KeyboardEvent, type ReactNode, useEffect, useId, useRef, useState } from "react";

/** 评论、推文和聊天共用的表情选择入口。 */
export interface EmojiPickerProps {
	trigger?: ReactNode;
	onSelect: (emoji: Emoji) => void;
	align?: "start" | "center" | "end";
	selectedIds?: Set<number>;
	/** 连续插入时保持浮层和输入框焦点。 */
	closeOnSelect?: boolean;
	/** 回应只接受系统表情时关闭。 */
	showMyEmojis?: boolean;
}

type GroupKey = number | "mine";

const groupTabClassName =
	"relative flex size-7 shrink-0 items-center justify-center text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring aria-selected:bg-popover aria-selected:font-medium aria-selected:text-foreground";

/** 会话切换会清除打开状态、分组位置和未提交的个人表情。 */
export function EmojiPicker(props: EmojiPickerProps) {
	const sessionVersion = useSessionStore((state) => state.sessionVersion);
	return <EmojiPickerSession key={sessionVersion} {...props} />;
}

function EmojiPickerSession({
	trigger,
	onSelect,
	align = "start",
	selectedIds,
	closeOnSelect = true,
	showMyEmojis = true,
}: EmojiPickerProps) {
	const [open, setOpen] = useState(false);
	const [selectedGroup, setSelectedGroup] = useState<GroupKey | null>(null);
	const { data, isLoading, isError, refetch } = useAllEmojis();
	const groups = data ?? [];
	const isLoggedIn = useSessionStore((state) => state.sessionActive);
	const hasMine = isLoggedIn && showMyEmojis;
	const keys: GroupKey[] = hasMine
		? ["mine", ...groups.map((group) => group.id)]
		: groups.map((group) => group.id);
	const activeKey =
		selectedGroup !== null && keys.includes(selectedGroup) ? selectedGroup : keys[0];
	const activeIndex = activeKey === undefined ? -1 : keys.indexOf(activeKey);
	const activeGroup = groups.find((group) => group.id === activeKey);
	const showingMine = activeKey === "mine";
	const id = useId();
	const navRef = useRef<HTMLDivElement>(null);
	const stripRef = useRef<HTMLDivElement>(null);
	const activeButtonRef = useRef<HTMLButtonElement>(null);
	const scrollPositions = useRef(new Map<GroupKey, number>());

	useEffect(() => {
		if (!open || activeKey === undefined) return;
		const strip = stripRef.current;
		const button = activeButtonRef.current;
		if (strip && button) {
			strip.scrollLeft = button.offsetLeft - (strip.clientWidth - button.offsetWidth) / 2;
		}
	}, [open, activeKey]);

	const handleSelect = (emoji: Emoji) => {
		onSelect(emoji);
		if (closeOnSelect) setOpen(false);
	};

	const navigate = (index: number, focus = false) => {
		const key = keys[index];
		if (key === undefined) return;
		setSelectedGroup(key);
		if (focus) {
			navRef.current
				?.querySelector<HTMLButtonElement>(`[data-group-key="${key}"]`)
				?.focus({ preventScroll: true });
		}
	};

	const handleNavigationKey = (event: KeyboardEvent<HTMLDivElement>) => {
		if (!(event.target instanceof HTMLElement) || event.target.getAttribute("role") !== "tab")
			return;
		let next: number;
		switch (event.key) {
			case "ArrowLeft":
				next = activeIndex - 1;
				break;
			case "ArrowRight":
				next = activeIndex + 1;
				break;
			case "Home":
				next = 0;
				break;
			case "End":
				next = keys.length - 1;
				break;
			default:
				return;
		}
		event.preventDefault();
		navigate(next, true);
	};

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				{trigger ?? (
					<Button
						type="button"
						variant="ghost"
						size="icon-xs"
						aria-label="添加表情"
						className="text-muted-foreground hover:text-foreground"
					>
						<Smile className="size-3.5" />
					</Button>
				)}
			</PopoverTrigger>
			<PopoverContent
				align={align}
				sideOffset={4}
				aria-label="表情选择器"
				className={cn("w-85 max-w-[calc(100vw-2rem)] p-0", styles.panel)}
				onOpenAutoFocus={(event) => event.preventDefault()}
				onFocusOutside={(event) => {
					if (!closeOnSelect) event.preventDefault();
				}}
			>
				<TooltipProvider delayDuration={200} skipDelayDuration={100}>
					<div className="mx-3 mt-3 flex items-center gap-1 bg-muted">
						<div
							ref={navRef}
							role="tablist"
							aria-label="表情分组"
							onKeyDown={handleNavigationKey}
							className="flex min-w-0 flex-1 items-center gap-1"
						>
							<div
								ref={stripRef}
								className="relative flex min-w-0 flex-1 gap-1 overflow-x-auto overscroll-x-contain [&::-webkit-scrollbar]:hidden"
								style={{ scrollbarWidth: "none" }}
							>
								{hasMine && (
									<button
										ref={showingMine ? activeButtonRef : undefined}
										type="button"
										role="tab"
										id={`${id}-mine`}
										aria-label="收藏表情"
										title="收藏表情"
										aria-selected={showingMine}
										aria-controls={`${id}-panel`}
										tabIndex={showingMine ? 0 : -1}
										data-group-key="mine"
										onClick={() => setSelectedGroup("mine")}
										className={groupTabClassName}
									>
										<Heart aria-hidden="true" className="size-5" />
									</button>
								)}
								{groups.map((group) => {
									const active = group.id === activeKey;
									return (
										<button
											key={group.id}
											ref={active ? activeButtonRef : undefined}
											type="button"
											role="tab"
											id={`${id}-${group.id}`}
											aria-label={group.name}
											title={group.name}
											aria-selected={active}
											aria-controls={`${id}-panel`}
											tabIndex={active ? 0 : -1}
											data-group-key={group.id}
											onClick={() => setSelectedGroup(group.id)}
											className={groupTabClassName}
										>
											{group.cover_url && isImageURL(group.cover_url) ? (
												<img
													src={group.cover_url}
													alt=""
													className="size-5 shrink-0 object-contain"
													loading="lazy"
												/>
											) : (
												<span className="truncate">{group.name}</span>
											)}
										</button>
									);
								})}
							</div>
						</div>
						<Button
							variant="ghost"
							size="icon-xs"
							aria-label="上一组"
							title="上一组"
							disabled={activeIndex <= 0}
							onClick={() => navigate(activeIndex - 1)}
						>
							<ChevronLeft className="size-4" />
						</Button>
						<Button
							variant="ghost"
							size="icon-xs"
							aria-label="下一组"
							title="下一组"
							disabled={activeIndex < 0 || activeIndex >= keys.length - 1}
							onClick={() => navigate(activeIndex + 1)}
						>
							<ChevronRight className="size-4" />
						</Button>
					</div>
					<ScrollArea
						key={activeKey}
						id={`${id}-panel`}
						role="tabpanel"
						aria-labelledby={activeKey === undefined ? undefined : `${id}-${activeKey}`}
						className="h-48 overscroll-contain px-3 pb-3"
						mask="none"
						ref={(element) => {
							if (element && activeKey !== undefined)
								element.scrollTop = scrollPositions.current.get(activeKey) ?? 0;
						}}
						onScroll={(event) => {
							if (activeKey !== undefined)
								scrollPositions.current.set(
									activeKey,
									event.currentTarget.scrollTop,
								);
						}}
					>
						{showingMine ? (
							<MyEmojisPanel onSelect={handleSelect} />
						) : isLoading ? (
							<div
								role="status"
								className="flex items-center justify-center py-8 text-muted-foreground"
							>
								<Loader2 className="mr-2 size-4 animate-spin motion-reduce:animate-none" />
								加载中…
							</div>
						) : isError && !data ? (
							<div className="flex flex-col items-center gap-2 py-6 text-sm text-muted-foreground">
								<p>表情加载失败</p>
								<Button variant="outline" size="sm" onClick={() => void refetch()}>
									重新加载
								</Button>
							</div>
						) : activeGroup && activeGroup.emojis.length > 0 ? (
							<div
								className={cn(
									"grid gap-1 pt-2",
									activeGroup.type === 1
										? "grid-cols-4"
										: activeGroup.meta?.size === 2
											? "grid-cols-5"
											: "grid-cols-10",
								)}
							>
								{activeGroup.emojis.map((emoji) => (
									<EmojiTile
										key={emoji.id}
										emoji={emoji}
										selected={selectedIds?.has(emoji.id)}
										onSelect={handleSelect}
									/>
								))}
							</div>
						) : (
							<p className="py-8 text-center text-sm text-muted-foreground">
								{activeGroup ? "该分组暂无表情" : "暂无可用表情"}
							</p>
						)}
					</ScrollArea>
				</TooltipProvider>
			</PopoverContent>
		</Popover>
	);
}

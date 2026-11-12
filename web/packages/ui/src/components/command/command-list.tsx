import { ChevronLeft, Search } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import {
	type CSSProperties,
	type KeyboardEvent,
	type ReactNode,
	useCallback,
	useEffect,
	useId,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import {
	type Opener,
	OpenerCapture,
	restoreFocus,
	useStackedScrim,
	useTrackClicks,
} from "../../lib/modal-opener";
import { iconProps } from "../icons";
import { Spinner, useDelayedBusy } from "../indicator";
import { Kbd } from "../kbd";
import { ListHighlight, ListHighlightItem } from "../list-highlight";
import { Skeleton } from "../skeleton";
import { type CommandGroup, type CommandItem, type CommandMatch, matchCommands } from "./match";

/** 执行前当前项亮一下的时长。 */
const FLASH_MS = 140;
/** 打开后列表展开与前 8 项依次浮现的时长。 */
const ENTER_MS = 400;
const STAGGER_COUNT = 8;

/** ⌘K 打开的命令面板：同一个输入框搜文章、跳页面、执行命令，所有操作都能不碰鼠标完成。 */
export interface CommandListProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** 第一级的候选；不输入时传最近与常用，输入后传全部 */
	items: CommandItem[];
	/** 分组与顺序，固定为文章、页面、命令；全文结果的组放最后 */
	groups: CommandGroup[];
	query: string;
	onQueryChange: (query: string) => void;
	/** 全文搜索中：输入框右侧转圈，全文那组显示两行骨架 */
	searching?: boolean;
	/** 全文结果所在的组；搜索中时骨架插在这组 */
	fullTextGroup?: string;
	/** 没有结果时给出唯一一项「在全文里搜索」，回车即可 */
	onSearchAll?: (query: string) => void;
	/**
	 * 每组最多显示几项。
	 * @default 5
	 */
	limit?: number;
	/** @default "搜索文章、页面与命令" */
	placeholder?: string;
	/**
	 * 模态：锁住背后、困住焦点，打开就聚焦输入框；关掉时不抢焦点，只用于陈列。
	 * @default true
	 */
	modal?: boolean;
	/** 挂载 Portal 的容器；默认 `document.body` */
	container?: HTMLElement | null;
}

type Push = "forward" | "back" | undefined;

/** 标题里匹配到的字加浅季节色底。 */
function Highlight({ label, ranges }: { label: string; ranges: CommandMatch["ranges"] }) {
	if (ranges.length === 0) return <>{label}</>;
	const parts: ReactNode[] = [];
	let cursor = 0;
	for (const [start, end] of ranges) {
		if (start > cursor) parts.push(label.slice(cursor, start));
		parts.push(
			<mark key={start} className="v-command__match">
				{label.slice(start, end)}
			</mark>,
		);
		cursor = end;
	}
	if (cursor < label.length) parts.push(label.slice(cursor));
	return <>{parts}</>;
}

/**
 * 命令面板：方向键在所有结果之间移动并循环，回车执行，⌘↵ 在新标签页打开；
 * Esc 先清空输入，在子页面时回到上一级，都没有时关闭；输入框为空时退格回到上一级。
 */
export function CommandList({
	open,
	onOpenChange,
	items,
	groups,
	query,
	onQueryChange,
	searching = false,
	fullTextGroup,
	onSearchAll,
	limit = 5,
	placeholder = "搜索文章、页面与命令",
	modal = true,
	container,
}: CommandListProps) {
	useTrackClicks();
	const stacked = useStackedScrim(open && modal);
	const openerRef = useRef<Opener>({ clicked: null, focus: null });
	const inputRef = useRef<HTMLInputElement>(null);
	const contentRef = useRef<HTMLDivElement>(null);
	const listRef = useRef<HTMLDivElement>(null);
	const viewportRef = useRef<HTMLDivElement>(null);
	const [trail, setTrail] = useState<CommandItem[]>([]);
	const [push, setPush] = useState<Push>();
	const [active, setActive] = useState(0);
	const [flashing, setFlashing] = useState<string | null>(null);
	const [entering, setEntering] = useState(false);
	const flashTimer = useRef<number | undefined>(undefined);
	const baseId = useId();
	const listboxId = `${baseId}-listbox`;
	const optionId = (index: number) => `${baseId}-option-${index}`;

	const level = trail.at(-1);
	// Radix 的 Esc 处理器可能拿到上一次渲染的闭包，最新的输入与层级从 ref 读
	const latest = useRef({ query, level, onQueryChange });
	latest.current = { query, level, onQueryChange };
	const sections = useMemo(
		() => matchCommands(level?.children ?? items, groups, query, limit),
		[level, items, groups, query, limit],
	);
	const flat = useMemo(() => sections.flatMap((section) => section.matches), [sections]);
	// 延迟只作用于视觉，列表的 aria-busy 立即生效
	const showBusy = useDelayedBusy(searching);
	const showSkeleton =
		showBusy && !level && query.trim().length >= 2 && fullTextGroup !== undefined;
	const empty = flat.length === 0 && !showSkeleton && query.trim().length > 0;
	const searchAll = empty && onSearchAll !== undefined && !level;
	const count = searchAll ? 1 : flat.length;

	const captureOpener = useCallback((opener: Opener) => {
		openerRef.current = opener;
	}, []);

	useEffect(() => () => window.clearTimeout(flashTimer.current), []);

	// 关掉再打开时回到第一级；刚打开的一小段时间里前 8 项依次浮现
	useEffect(() => {
		if (open) {
			setEntering(true);
			const timer = window.setTimeout(() => setEntering(false), ENTER_MS);
			return () => window.clearTimeout(timer);
		}
		setTrail([]);
		setPush(undefined);
		setFlashing(null);
	}, [open]);

	// 结果变化时当前项回到第一项
	// biome-ignore lint/correctness/useExhaustiveDependencies: 依赖的是结果本身而不是读取它
	useLayoutEffect(() => {
		setActive(0);
	}, [sections, trail]);

	// 列表的高度跟着结果数量变化
	useLayoutEffect(() => {
		const list = listRef.current;
		const viewport = viewportRef.current;
		if (!list || !viewport) return;
		const update = () =>
			viewport.style.setProperty("--v-command-list", `${list.offsetHeight}px`);
		update();
		if (typeof ResizeObserver === "undefined") return;
		const observer = new ResizeObserver(update);
		observer.observe(list);
		return () => observer.disconnect();
	});

	// 当前项滚出可视区时自动滚到它；回到第一项时连同组名一起回到顶部
	// biome-ignore lint/correctness/useExhaustiveDependencies: 只在当前项变化时滚动
	useEffect(() => {
		const viewport = viewportRef.current;
		if (active === 0 && viewport) viewport.scrollTop = 0;
		else document.getElementById(optionId(active))?.scrollIntoView({ block: "nearest" });
	}, [active]);

	const enter = (item: CommandItem) => {
		setTrail((current) => [...current, item]);
		setPush("forward");
		onQueryChange("");
	};

	const back = () => {
		setTrail((current) => current.slice(0, -1));
		setPush("back");
		latest.current.onQueryChange("");
	};

	const run = (index: number, newTab: boolean) => {
		if (flashing) return;
		if (searchAll) {
			onSearchAll?.(query);
			onOpenChange(false);
			return;
		}
		const match = flat[index];
		if (!match) return;
		if (match.item.children) {
			enter(match.item);
			return;
		}
		// 当前项亮一下再执行并收起
		setFlashing(match.item.id);
		flashTimer.current = window.setTimeout(() => {
			match.item.onSelect?.({ newTab });
			onOpenChange(false);
		}, FLASH_MS);
	};

	const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
		if (event.nativeEvent.isComposing) return;
		if (event.key === "ArrowDown" || event.key === "ArrowUp") {
			event.preventDefault();
			if (count === 0) return;
			const step = event.key === "ArrowDown" ? 1 : -1;
			setActive((current) => (current + step + count) % count);
		} else if (event.key === "Enter") {
			event.preventDefault();
			run(active, event.metaKey || event.ctrlKey);
		} else if (event.key === "Backspace" && query === "" && level) {
			event.preventDefault();
			back();
		}
	};

	let index = -1;

	return (
		<DialogPrimitive.Root open={open} onOpenChange={onOpenChange} modal={modal}>
			{open && <OpenerCapture onCapture={captureOpener} />}
			<DialogPrimitive.Portal container={container}>
				<DialogPrimitive.Overlay
					data-slot="command-overlay"
					data-stacked={stacked || undefined}
					className="v-scrim v-scrim--soft v-command-overlay"
				/>
				<DialogPrimitive.Content
					ref={contentRef}
					data-slot="command"
					className="v-command"
					aria-describedby={undefined}
					onOpenAutoFocus={(event) => {
						event.preventDefault();
						if (modal) inputRef.current?.focus({ preventScroll: true });
					}}
					onCloseAutoFocus={(event) => {
						event.preventDefault();
						restoreFocus(openerRef.current.focus);
					}}
					onInteractOutside={(event) => {
						// 陈列用的非模态面板只在挂载容器里的点击时收起，页面其余地方不打扰它
						const target = event.target as Node | null;
						if (!modal && !(container && target && container.contains(target))) {
							event.preventDefault();
						}
					}}
					onEscapeKeyDown={(event) => {
						if (!modal && !contentRef.current?.contains(document.activeElement)) {
							event.preventDefault();
						} else if (latest.current.query) {
							event.preventDefault();
							latest.current.onQueryChange("");
						} else if (latest.current.level) {
							event.preventDefault();
							back();
						}
					}}
				>
					<DialogPrimitive.Title className="v-command__title">
						命令面板
					</DialogPrimitive.Title>
					<div className="v-command__field">
						{level ? (
							<button type="button" className="v-command__trail" onClick={back}>
								<ChevronLeft {...iconProps(14)} aria-hidden="true" />
								{level.label}
							</button>
						) : (
							<Search aria-hidden="true" className="v-command__icon" />
						)}
						<input
							ref={inputRef}
							role="combobox"
							aria-expanded="true"
							aria-controls={listboxId}
							aria-autocomplete="list"
							aria-activedescendant={count > 0 ? optionId(active) : undefined}
							aria-label={level ? `在「${level.label}」里搜索` : placeholder}
							className="v-command__input"
							placeholder={level ? `在「${level.label}」里搜索` : placeholder}
							value={query}
							autoComplete="off"
							spellCheck={false}
							onChange={(event) => onQueryChange(event.currentTarget.value)}
							onKeyDown={handleKeyDown}
						/>
						{showBusy ? (
							<Spinner
								size={16}
								aria-label="正在搜索全文"
								className="v-command__busy"
							/>
						) : (
							<Kbd size="sm">Esc</Kbd>
						)}
					</div>
					<div ref={viewportRef} className="v-command__viewport">
						<ListHighlight mode="active" key={trail.length}>
							<div
								ref={listRef}
								id={listboxId}
								role="listbox"
								aria-label={level ? level.label : "结果"}
								aria-busy={searching || undefined}
								data-push={push}
								className="v-command__list"
							>
								{sections.map(({ group, matches }) => {
									const labelId = `${baseId}-group-${group.id}`;
									return (
										<div
											key={group.id}
											role="group"
											aria-labelledby={group.label ? labelId : undefined}
											className="v-command__group"
										>
											{group.label && (
												<div
													id={labelId}
													className="v-command__group-label"
												>
													{group.label}
												</div>
											)}
											{matches.map((match) => {
												index += 1;
												const itemIndex = index;
												const { item } = match;
												return (
													<ListHighlightItem
														key={item.id}
														active={itemIndex === active}
													>
														{/* biome-ignore lint/a11y/useKeyWithClickEvents: 键盘由输入框经 aria-activedescendant 操作 */}
														<div
															tabIndex={-1}
															id={optionId(itemIndex)}
															role="option"
															aria-selected={itemIndex === active}
															data-active={
																itemIndex === active || undefined
															}
															data-flash={
																flashing === item.id || undefined
															}
															data-stagger={
																(entering &&
																	itemIndex < STAGGER_COUNT) ||
																undefined
															}
															style={
																{
																	"--v-command-i": itemIndex,
																} as CSSProperties
															}
															className="v-command__item"
															onPointerMove={() => {
																if (active !== itemIndex)
																	setActive(itemIndex);
															}}
															onPointerDown={(event) =>
																event.preventDefault()
															}
															onClick={(event) =>
																run(
																	itemIndex,
																	event.metaKey || event.ctrlKey,
																)
															}
														>
															{item.icon && (
																<span
																	aria-hidden="true"
																	className="v-command__item-icon"
																>
																	{item.icon}
																</span>
															)}
															<span className="v-command__item-text">
																<span className="v-command__item-label">
																	<Highlight
																		label={item.label}
																		ranges={match.ranges}
																	/>
																</span>
																{item.description && (
																	<span className="v-command__item-description">
																		{item.description}
																	</span>
																)}
															</span>
															{item.shortcut ? (
																<Kbd
																	size="sm"
																	keys={item.shortcut}
																/>
															) : item.hint ? (
																<span className="v-command__item-hint">
																	{item.hint}
																</span>
															) : item.children ? (
																<span className="v-command__item-hint">
																	›
																</span>
															) : null}
														</div>
													</ListHighlightItem>
												);
											})}
											{showSkeleton && group.id === fullTextGroup && (
												<FullTextSkeleton />
											)}
										</div>
									);
								})}
								{showSkeleton &&
									!sections.some(({ group }) => group.id === fullTextGroup) && (
										<div
											role="group"
											aria-label="全文"
											className="v-command__group"
										>
											<div className="v-command__group-label">全文</div>
											<FullTextSkeleton />
										</div>
									)}
								{empty && (
									<div className="v-command__empty">
										<p className="v-command__empty-text">
											没有找到「{query.trim()}」
										</p>
										{searchAll && (
											<ListHighlightItem active={active === 0}>
												{/* biome-ignore lint/a11y/useKeyWithClickEvents: 键盘由输入框经 aria-activedescendant 操作 */}
												<div
													tabIndex={-1}
													id={optionId(0)}
													role="option"
													aria-selected="true"
													data-active=""
													className="v-command__item"
													onPointerDown={(event) =>
														event.preventDefault()
													}
													onClick={() => run(0, false)}
												>
													<span
														aria-hidden="true"
														className="v-command__item-icon"
													>
														<Search />
													</span>
													<span className="v-command__item-label">
														在全文里搜索
													</span>
												</div>
											</ListHighlightItem>
										)}
									</div>
								)}
							</div>
						</ListHighlight>
					</div>
					<div className="v-command__footer">
						<span className="v-command__keys">
							<Kbd size="sm" keys={["up"]} />
							<Kbd size="sm" keys={["down"]} />
							选择
							<Kbd size="sm" keys={["enter"]} />
							打开
							<Kbd size="sm" keys={["mod", "enter"]} />
							新标签打开
						</span>
						<span className="v-command__status">
							{level ? level.label : count > 0 ? `${count} 项` : ""}
						</span>
					</div>
				</DialogPrimitive.Content>
			</DialogPrimitive.Portal>
		</DialogPrimitive.Root>
	);
}

/** 全文搜索结果回来之前占两行。 */
function FullTextSkeleton() {
	return (
		<div aria-hidden="true" className="v-command__skeleton">
			{[0, 1].map((row) => (
				<div key={row} className="v-command__skeleton-row">
					<Skeleton className="v-command__skeleton-title" />
					<Skeleton className="v-command__skeleton-line" />
				</div>
			))}
		</div>
	);
}

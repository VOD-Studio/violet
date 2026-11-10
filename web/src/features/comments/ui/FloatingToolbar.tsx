import { useAnnotationAnchorVisible } from "@features/comments/hooks/use-annotation-anchor-visible";
import { useBrushColors } from "@features/comments/hooks/use-brush-colors";
import { useSubmitAnnotation } from "@features/comments/hooks/use-submit-annotation";
import { findBlockElement } from "@features/comments/lib/extract-blocks";
import { clearMarks, wrapRange } from "@features/comments/lib/range-marks";
import {
	clearSelection,
	isSelectionInUnannotatableContainer,
	selectionToAnchor,
} from "@features/comments/lib/selection-to-anchor";
import type { Anchor } from "@features/comments/lib/types";
import { Copy, LogIn, MessageSquareQuote } from "lucide-react";
import { Popover } from "radix-ui";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import "./annotations.css";
import { AnnotationComposer } from "./AnnotationComposer";
import { AnnotationPortal } from "./AnnotationPortal";
import { AnnotationOverlayContext } from "./annotation-overlay-context";
import { useExclusivePanel } from "./use-exclusive-panel";

/** 草稿划线 mark 的 class：写批注时用选中态的深底标出正在批注的文字。 */
const DRAFT_MARK_CLASS = "annotation-draft-mark";
/** 工具条半宽的上限，夹在视口内时据此留边。 */
const TOOLBAR_HALF_WIDTH_PX = 90;
/** 工具条与选区的间距 */
const GAP_PX = 8;
/** 工具条自身高度加箭头，选区贴近视口顶部时据此压住上沿。 */
const TOOLBAR_CLEARANCE_PX = 56;

/** 划词交互所需的正文范围与登录快照。 */
export interface FloatingToolbarProps {
	/** 正文容器 ref（选区必须在此容器内才显示工具条） */
	contentRef: React.RefObject<HTMLElement | null>;
	/** 当前是否登录（决定按钮文案与行为） */
	isLoggedIn: boolean;
	/** 文章 id（提交批注用） */
	postId: string;
	/** 鼠标是否按着；首次选择触发懒加载，模块挂载时选区可能还在拖，据此决定是否等松开。 */
	pointerPressed?: React.RefObject<boolean>;
}

/** 工具条的视口坐标：它浮在 top 之上，水平居中于 left。 */
interface ToolbarPos {
	top: number;
	left: number;
	offscreen: boolean;
}

const isShortcut = (event: KeyboardEvent) =>
	(event.metaKey || event.ctrlKey) &&
	event.shiftKey &&
	!event.altKey &&
	event.key.toLowerCase() === "m";

/**
 * 接管正文选区：松开鼠标后在选区上方浮出「批注」「复制」，批注在选区下方展开批注卡。
 *
 * @remarks 键盘与触屏没有「松开」，选区出现即显示；⌘⇧M（Ctrl+Shift+M）等同点「批注」。
 * 挂载时处理已有选区；滚动只重新定位，不改变讨论范围。
 */
export function FloatingToolbar({
	contentRef,
	isLoggedIn,
	postId,
	pointerPressed,
}: FloatingToolbarProps) {
	useBrushColors();
	const [pos, setPos] = useState<ToolbarPos | null>(null);
	const [anchor, setAnchor] = useState<Anchor | null>(null);
	const [isCrossBlock, setIsCrossBlock] = useState(false);
	const [composing, setComposing] = useState(false);
	/** 写批注时固定下来的选区；批注卡退场动画期间仍要显示其原文。 */
	const [draft, setDraft] = useState<Anchor | null>(null);
	const [body, setBody] = useState("");
	const toolbarRef = useRef<HTMLDivElement>(null);
	const { submit, pending } = useSubmitAnnotation(postId);

	// 缓存最近一次有效选区的 Range，用于滚动时重新定位（滚动不触发 selectionchange）。
	const lastRangeRef = useRef<Range | null>(null);
	const draftAnchorRef = useRef<Anchor | null>(null);
	const pressedRef = useRef(pointerPressed?.current ?? false);

	// 批注卡的定位参照：写批注时是草稿划线的范围，收起后停在最后一次量到的矩形，退场不跳位。
	const frozenRect = useRef(new DOMRect());
	const cardAnchor = useMemo(
		() => ({
			getBoundingClientRect: () => {
				const range = lastRangeRef.current;
				if (range) frozenRect.current = range.getBoundingClientRect();
				return frozenRect.current;
			},
		}),
		[],
	);
	const cardVisible = useAnnotationAnchorVisible(cardAnchor, composing);

	const toolbarPos = useCallback((range: Range): ToolbarPos => {
		const rect = range.getBoundingClientRect();
		const offscreen =
			(rect.width === 0 && rect.height === 0) ||
			rect.bottom < 0 ||
			rect.top > window.innerHeight;
		if (offscreen && toolbarRef.current?.contains(document.activeElement)) {
			(document.activeElement as HTMLElement).blur();
		}
		const half = Math.min(TOOLBAR_HALF_WIDTH_PX, (window.innerWidth - 32) / 2);
		return {
			top: Math.max(TOOLBAR_CLEARANCE_PX, rect.top - GAP_PX),
			left: Math.max(
				half + 16,
				Math.min(rect.left + rect.width / 2, window.innerWidth - half - 16),
			),
			offscreen,
		};
	}, []);

	// 选区处理优先于位置跟随，滚动不能取消尚未执行的首次选区接管。
	useEffect(() => {
		let rafId = 0;
		const handleSelectionChange = () => {
			// 批注卡展开时不响应新选区（避免用户在输入框里选词触发工具条）
			if (composing) return;
			cancelAnimationFrame(rafId);
			rafId = requestAnimationFrame(async () => {
				rafId = 0;
				const root = contentRef.current;
				if (!root) return;

				const selection = window.getSelection();
				if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
					lastRangeRef.current = null;
					setPos(null);
					setAnchor(null);
					setIsCrossBlock(false);
					return;
				}

				// 选区必须在正文容器内
				const range = selection.getRangeAt(0);
				if (!root.contains(range.commonAncestorContainer)) {
					lastRangeRef.current = null;
					setPos(null);
					return;
				}

				// 不可批注容器（代码块/图块/块级公式）→ 直接隐藏，不置灰。
				// 区别于跨块：跨块是用户选了多段（置灰 + 提示），这里选的是单个不可批注块，
				// 置灰 tooltip "请在同一段落内选择" 会误导用户，应直接消失。
				if (isSelectionInUnannotatableContainer(range)) {
					lastRangeRef.current = null;
					setPos(null);
					setAnchor(null);
					setIsCrossBlock(false);
					return;
				}

				// 缓存 Range 供滚动重定位用
				lastRangeRef.current = range.cloneRange();

				// 算 anchor（含跨块判定）
				const result = await selectionToAnchor({ root });
				if (result) {
					setAnchor(result);
					setIsCrossBlock(false);
				} else {
					setAnchor(null);
					setIsCrossBlock(true);
				}

				// 鼠标还按着说明仍在拖选，松开后再出现
				if (pressedRef.current) return;
				setPos(toolbarPos(range));
			});
		};

		// 按下鼠标开始新选区：旧工具条随即收起；松开后按最终选区重新判定。
		const handlePointerDown = (event: PointerEvent) => {
			if (event.pointerType === "touch") return;
			if (toolbarRef.current?.contains(event.target as Node)) return;
			pressedRef.current = true;
			setPos(null);
		};
		const handlePointerUp = (event: Event) => {
			if (toolbarRef.current?.contains(event.target as Node)) return;
			pressedRef.current = false;
			handleSelectionChange();
		};

		// 滚动时用缓存的 Range 重新算视口位置（fixed 定位跟随）；批注卡由 Popper 自行跟随。
		// capture: true 捕获阶段监听，避免被正文里的 stopPropagation 拦截。
		const handleScroll = () => {
			if (composing || rafId) return;
			rafId = requestAnimationFrame(() => {
				rafId = 0;
				const range = lastRangeRef.current;
				if (range) setPos(toolbarPos(range));
			});
		};

		document.addEventListener("selectionchange", handleSelectionChange);
		document.addEventListener("pointerdown", handlePointerDown, true);
		window.addEventListener("pointerup", handlePointerUp, true);
		window.addEventListener("pointercancel", handlePointerUp, true);
		window.addEventListener("scroll", handleScroll, { passive: true, capture: true });
		window.addEventListener("resize", handleScroll);
		handleSelectionChange();
		return () => {
			document.removeEventListener("selectionchange", handleSelectionChange);
			document.removeEventListener("pointerdown", handlePointerDown, true);
			window.removeEventListener("pointerup", handlePointerUp, true);
			window.removeEventListener("pointercancel", handlePointerUp, true);
			window.removeEventListener("scroll", handleScroll, { capture: true });
			window.removeEventListener("resize", handleScroll);
			cancelAnimationFrame(rafId);
		};
	}, [contentRef, composing, toolbarPos]);

	/** 把选区文字标成草稿划线（输入框获得焦点后浏览器选区视觉会淡化，需要持续可见）。 */
	const addDraftMark = async (target: Anchor) => {
		const root = contentRef.current;
		if (!root) return;
		const el = await findBlockElement(root, target.blockId);
		if (!el || draftAnchorRef.current !== target) return;
		const marks = wrapRange(
			el,
			{ start: target.startOffset, end: target.endOffset },
			DRAFT_MARK_CLASS,
		);
		const first = marks[0];
		const last = marks.at(-1);
		if (first && last) {
			// 包装文字会重定向旧 Range 的端点，定位必须重新绑定到草稿标记。
			const range = document.createRange();
			range.setStartBefore(first);
			range.setEndAfter(last);
			lastRangeRef.current = range;
		}
	};

	/** 点「批注」或按 ⌘⇧M：展开批注卡；未登录时卡里先登录 */
	const handleAnnotate = () => {
		if (!anchor || isCrossBlock || !lastRangeRef.current) return;
		draftAnchorRef.current = anchor;
		frozenRect.current = lastRangeRef.current.getBoundingClientRect();
		setDraft(anchor);
		void addDraftMark(anchor);
		setComposing(true);
		setBody("");
	};

	const handleCopy = async () => {
		const text = lastRangeRef.current?.toString() ?? "";
		lastRangeRef.current = null;
		setPos(null);
		try {
			await navigator.clipboard.writeText(text);
			toast.success("已复制");
		} catch {
			toast.error("复制失败");
		}
	};

	/** 收起批注卡并清掉选区；先记下卡片位置，草稿划线拆掉后退场动画也不会跳位。 */
	const finish = () => {
		if (lastRangeRef.current) frozenRect.current = lastRangeRef.current.getBoundingClientRect();
		lastRangeRef.current = null;
		draftAnchorRef.current = null;
		if (contentRef.current) clearMarks(contentRef.current, DRAFT_MARK_CLASS);
		setComposing(false);
		setBody("");
		setPos(null);
		setAnchor(null);
		clearSelection();
	};

	const handleSubmit = () => {
		if (!draft || !body.trim()) return;
		submit(body, draft, finish);
	};

	useExclusivePanel("selection", composing, finish);

	// 键盘监听只注册一次，通过 ref 取到最新一帧的处理函数。
	const annotateRef = useRef(handleAnnotate);
	useEffect(() => {
		annotateRef.current = handleAnnotate;
	});
	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (isShortcut(event)) {
				if (composing || !lastRangeRef.current) return;
				event.preventDefault();
				if (isCrossBlock) toast.info("请在同一段落内选择");
				else annotateRef.current();
				return;
			}
			const toolbar = toolbarRef.current;
			if (composing || !toolbar) return;
			const active = document.activeElement;
			if (event.key === "Escape" && toolbar.contains(active)) {
				lastRangeRef.current = null;
				setPos(null);
				return;
			}
			// 选区在正文里时 Tab 先到工具条，工具条本身在文档末尾，顺序 Tab 走不到。
			if (event.key !== "Tab" || event.shiftKey || toolbar.contains(active)) return;
			if (active === document.body || contentRef.current?.contains(active)) {
				event.preventDefault();
				toolbar.querySelector<HTMLElement>("button:not(:disabled)")?.focus();
			}
		};
		document.addEventListener("keydown", onKeyDown);
		return () => document.removeEventListener("keydown", onKeyDown);
	}, [composing, isCrossBlock, contentRef]);

	return (
		<>
			{pos && !composing && (
				<AnnotationPortal>
					<div
						ref={toolbarRef}
						role="toolbar"
						aria-label="批注工具"
						className="annotation-selection-toolbar"
						style={{ top: pos.top, left: pos.left }}
						inert={pos.offscreen}
						aria-hidden={pos.offscreen || undefined}
						data-offscreen={pos.offscreen ? "true" : undefined}
					>
						<button
							type="button"
							className="annotation-tool"
							// preventDefault 防止 mousedown 清掉选区：选区一清，工具条就没有可定位的对象。
							onMouseDown={(event) => event.preventDefault()}
							onClick={handleAnnotate}
							disabled={isCrossBlock}
							title={isCrossBlock ? "请在同一段落内选择" : undefined}
							aria-keyshortcuts="Meta+Shift+M Control+Shift+M"
						>
							{isLoggedIn ? (
								<>
									<MessageSquareQuote className="size-4" aria-hidden="true" />
									批注
								</>
							) : (
								<>
									<LogIn className="size-4" aria-hidden="true" />
									登录后批注
								</>
							)}
						</button>
						<button
							type="button"
							className="annotation-tool"
							onMouseDown={(event) => event.preventDefault()}
							onClick={handleCopy}
						>
							<Copy className="size-4" aria-hidden="true" />
							复制
						</button>
						<i aria-hidden="true" />
					</div>
				</AnnotationPortal>
			)}
			{draft && (
				<Popover.Root open={composing} onOpenChange={(next) => !next && finish()}>
					<Popover.Anchor virtualRef={{ current: cardAnchor }} />
					<AnnotationPortal>
						<Popover.Content
							aria-label="新批注"
							aria-hidden={!cardVisible || !composing ? true : undefined}
							inert={!cardVisible || !composing}
							data-offscreen={cardVisible ? undefined : "true"}
							side="bottom"
							align="center"
							sideOffset={GAP_PX}
							collisionPadding={16}
							onOpenAutoFocus={(event) => event.preventDefault()}
							onCloseAutoFocus={(event) => event.preventDefault()}
							onInteractOutside={(event) => {
								// 聚焦移动不算离开；真正的外部按下才收起
								if (event.detail.originalEvent.type === "focusin")
									event.preventDefault();
							}}
							className="annotation-card v-float z-50 outline-none"
						>
							<AnnotationOverlayContext value={composing && cardVisible}>
								<blockquote className="annotation-quote">
									{draft.selectedText}
								</blockquote>
								<AnnotationComposer
									autoFocus
									body={body}
									onBodyChange={setBody}
									onSubmit={handleSubmit}
									pending={pending}
									placeholder="写下你的批注…"
									editorLabel="批注内容"
									sendLabel="提交批注"
									loginRequired={!isLoggedIn}
									onLoggedIn={handleSubmit}
								/>
							</AnnotationOverlayContext>
						</Popover.Content>
					</AnnotationPortal>
				</Popover.Root>
			)}
		</>
	);
}

export default FloatingToolbar;

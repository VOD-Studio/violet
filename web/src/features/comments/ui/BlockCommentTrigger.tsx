import { getBlockText } from "@features/comments/lib/extract-blocks";
import {
	closestAnnotatableBlock,
	listAnnotatableBlocks,
} from "@features/comments/lib/selection-to-anchor";
import { createAsyncLoader } from "@shared/lib/create-async-loader";
import { DeferredContent } from "@shared/ui/deferred-content/DeferredContent";
import { AnnotationCardFrame, iconProps } from "@violet/ui";
import { MessageSquareText } from "lucide-react";
import { Popover } from "radix-ui";
import {
	type KeyboardEvent,
	useCallback,
	useEffect,
	useRef,
	useState,
	useSyncExternalStore,
} from "react";
import { useAnnotationAnchorVisible } from "../hooks/use-annotation-anchor-visible";
import { AnnotationPending } from "./AnnotationPending";
import { AnnotationPortal } from "./AnnotationPortal";
import { AnnotationQuote } from "./AnnotationQuote";
import { AnnotationOverlayContext } from "./annotation-overlay-context";
import { useExclusivePanel } from "./use-exclusive-panel";

const loadBlockComposer = createAsyncLoader(() =>
	import("./BlockAnnotationComposer").then((module) => ({
		default: module.BlockAnnotationComposer,
	})),
);

/** 指针离开段落后入口延迟隐藏的时间，留给指针经过留白移向入口按钮。 */
const HIDE_DELAY_MS = 300;
/** 入口纵向对齐块首行的偏移，px */
const TOP_OFFSET_PX = 2;
/** 触屏入口与段落底边的间距，px */
const BELOW_GAP_PX = 4;
/** 触屏入口与末行文字的间距，px */
const INLINE_GAP_PX = 6;
/** 入口圆钮边长，与样式里的 1.75rem 一致，px */
const ENTRY_SIZE_PX = 28;
/** 输入面板与所批注段落底边的间距，px */
const COMPOSER_GAP_PX = 8;
/** 入口读屏名称里引用的段落开头字数 */
const LABEL_EXCERPT = 24;
const DRAFT_CLASS = "annotation-draft-highlight";
/** 水合标记没有会变的外部来源，订阅什么也不做。 */
const subscribeNever = () => () => {};

/**
 * 入口当前跟随哪种操作：鼠标悬停时落在段落右侧页边，触屏点按时落在段落右下方，
 * 键盘聚焦时跟随方向键选中的段落。
 */
type EntryMode = "pointer" | "touch" | "keyboard";

/** 正文中的段评入口及其浮层定位上下文。 */
export interface BlockCommentTriggerProps {
	contentRef: React.RefObject<HTMLElement | null>;
	/** 覆盖层元素：入口的纵向坐标相对它计算 */
	layerRef: React.RefObject<HTMLElement | null>;
	/** 已有批注的块在批注面板中提供独立段评入口，避免侧栏入口与头像重叠。 */
	annotatedBlocks: ReadonlySet<HTMLElement>;
	isLoggedIn: boolean;
	postId: string;
}

/**
 * 正文的段评入口：鼠标悬停段落时出现在右侧页边，触屏点按段落时出现在段落右下方，
 * 键盘可直接 Tab 到入口并用上下方向键在段落间移动。
 *
 * 点击后在段落下方展开输入面板，对整段文字发表批注（锚点覆盖全块）；
 * 已有批注的段落由页边数量入口负责，这里不再叠一个入口。入口与面板都不进正文流。
 */
export function BlockCommentTrigger({
	contentRef,
	layerRef,
	annotatedBlocks,
	isLoggedIn,
	postId,
}: BlockCommentTriggerProps) {
	const [current, setCurrent] = useState<HTMLElement | null>(null);
	const [mode, setMode] = useState<EntryMode>("pointer");
	const [focused, setFocused] = useState(false);
	const [hasBlocks, setHasBlocks] = useState(false);
	const hydrated = useSyncExternalStore(
		subscribeNever,
		() => true,
		() => false,
	);
	const [top, setTop] = useState(0);
	const [height, setHeight] = useState(0);
	const [composerBlock, setComposerBlock] = useState<HTMLElement | null>(null);
	const buttonRef = useRef<HTMLButtonElement>(null);
	const hideTimer = useRef<number | undefined>(undefined);
	/** 指针当前在入口或右侧热区上：此时不安排收起。 */
	const overEntry = useRef(false);
	/** 面板关闭后把焦点还给入口：键盘与触屏打开时需要，鼠标打开时不抢焦点。 */
	const returnFocus = useRef(false);
	const composerVisible = useAnnotationAnchorVisible(composerBlock, composerBlock !== null);

	const candidates = useCallback(() => {
		const root = contentRef.current;
		return root
			? listAnnotatableBlocks(root).filter((block) => !annotatedBlocks.has(block))
			: [];
	}, [contentRef, annotatedBlocks]);

	useEffect(() => {
		if (hydrated) setHasBlocks(candidates().length > 0);
	}, [hydrated, candidates]);

	const scheduleHide = useCallback(() => {
		if (overEntry.current) return;
		clearTimeout(hideTimer.current);
		hideTimer.current = window.setTimeout(() => setCurrent(null), HIDE_DELAY_MS);
	}, []);
	const enterEntry = useCallback(() => {
		overEntry.current = true;
		clearTimeout(hideTimer.current);
	}, []);
	const leaveEntry = useCallback(() => {
		overEntry.current = false;
		if (!focused) scheduleHide();
	}, [focused, scheduleHide]);

	useEffect(() => {
		const root = contentRef.current;
		if (!root) return;
		let frame = 0;
		const onMove = (event: globalThis.MouseEvent) => {
			cancelAnimationFrame(frame);
			frame = requestAnimationFrame(() => {
				const block = closestAnnotatableBlock(event.target, root);
				// 指针落在段落之间或段落与右缘的留白上，多半是在赶往右侧入口：保留当前段，延时再收起。
				if (!block) {
					scheduleHide();
					return;
				}
				clearTimeout(hideTimer.current);
				setMode((cur) => (cur === "touch" ? cur : "pointer"));
				setCurrent((cur) => (cur === block ? cur : block));
			});
		};
		// 离开正文时排在下一帧的移动回调作废，免得它在指针已到入口上之后才安排收起。
		const onLeave = () => {
			cancelAnimationFrame(frame);
			if (!focused) scheduleHide();
		};
		// 触屏没有悬停：点按一段文字（不是选词）就把入口放到这段下面，点到别处收起。
		const onPointerDown = (event: PointerEvent) => {
			if (event.pointerType !== "touch") {
				setMode((cur) => (cur === "touch" ? "pointer" : cur));
				return;
			}
			if (buttonRef.current?.contains(event.target as Node)) return;
			const block = root.contains(event.target as Node)
				? closestAnnotatableBlock(event.target, root)
				: null;
			clearTimeout(hideTimer.current);
			setMode("touch");
			setCurrent(block);
		};
		root.addEventListener("mousemove", onMove);
		root.addEventListener("mouseleave", onLeave);
		document.addEventListener("pointerdown", onPointerDown, true);
		return () => {
			cancelAnimationFrame(frame);
			clearTimeout(hideTimer.current);
			root.removeEventListener("mousemove", onMove);
			root.removeEventListener("mouseleave", onLeave);
			document.removeEventListener("pointerdown", onPointerDown, true);
		};
	}, [contentRef, scheduleHide, focused]);

	const visibleBlock = composerBlock ?? current;
	const touch = mode === "touch";
	/** 触屏入口的横向位置：跟在末行文字后面；末行写满时为 null，退到段落右下方。 */
	const [inlineLeft, setInlineLeft] = useState<number | null>(null);
	useEffect(() => {
		const layer = layerRef.current;
		if (!visibleBlock || !layer) return;
		const rect = visibleBlock.getBoundingClientRect();
		const layerRect = layer.getBoundingClientRect();
		setHeight(rect.height);
		if (!touch) {
			setTop(rect.top - layerRect.top + TOP_OFFSET_PX);
			return;
		}
		const range = document.createRange();
		range.selectNodeContents(visibleBlock);
		// jsdom 没有 Range 几何 API：退到段落下方，与末行写满时相同
		const lines = typeof range.getClientRects === "function" ? range.getClientRects() : [];
		const last = lines[lines.length - 1];
		if (last && last.right + INLINE_GAP_PX + ENTRY_SIZE_PX <= layerRect.right) {
			setTop(last.top - layerRect.top + (last.height - ENTRY_SIZE_PX) / 2);
			setInlineLeft(last.right - layerRect.left + INLINE_GAP_PX);
		} else {
			setTop(rect.bottom - layerRect.top + BELOW_GAP_PX);
			setInlineLeft(null);
		}
	}, [visibleBlock, layerRef, touch]);
	const below = touch && inlineLeft === null;

	const close = useCallback(() => {
		setComposerBlock((cur) => {
			cur?.classList.remove(DRAFT_CLASS);
			return null;
		});
	}, []);
	useExclusivePanel("block", composerBlock !== null, close);

	const open = (fromKeyboard: boolean) => {
		if (!current) return;
		// 只有键盘唤出（Enter/Space，click.detail 为 0）才在关闭后要回焦点；
		// 鼠标点开时焦点先于 click 落到入口（mode 已是 keyboard），若据此还焦，
		// 面板一关焦点又被程序化送回入口，指针悬停会被「键盘接管」挡住。
		returnFocus.current = fromKeyboard;
		if (isLoggedIn) current.classList.add(DRAFT_CLASS);
		setComposerBlock(current);
	};

	/** 移动端浏览器在正文覆盖层上点按按钮常不派发 click：touchend 时直接打开。 */
	const onTouchEnd = (event: React.TouchEvent<HTMLButtonElement>) => {
		if (event.cancelable) event.preventDefault();
		open(false);
	};

	/** 键盘移动到相邻可段评段落，并把它滚进视口。 */
	const move = (step: 1 | -1) => {
		const blocks = candidates();
		if (blocks.length === 0) return;
		const index = current ? blocks.indexOf(current) : -1;
		const next =
			index < 0
				? blocks[step > 0 ? 0 : blocks.length - 1]
				: blocks[Math.min(blocks.length - 1, Math.max(0, index + step))];
		next.scrollIntoView({ block: "nearest" });
		setCurrent(next);
	};

	const onFocus = () => {
		clearTimeout(hideTimer.current);
		setFocused(true);
		setMode("keyboard");
		if (current && !annotatedBlocks.has(current)) return;
		// 从视口里第一段开始：读者正在看的地方，不必从文首一路按下来
		const blocks = candidates();
		const inView = blocks.find((block) => block.getBoundingClientRect().bottom > 0);
		setCurrent(inView ?? blocks[0] ?? null);
	};
	const onBlur = () => {
		setFocused(false);
		// 焦点进了刚打开的面板时保留这一段，面板关闭后焦点回到入口仍指向它
		if (!overEntry.current && !composerBlock) setCurrent(null);
	};
	const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
		if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
		event.preventDefault();
		move(event.key === "ArrowDown" ? 1 : -1);
	};

	const showTrigger = Boolean(visibleBlock && !annotatedBlocks.has(visibleBlock));
	// 入口一出现就取输入面板的模块：指针移过去点开时多半已经到位，面板直接是输入框。
	useEffect(() => {
		if (showTrigger) void loadBlockComposer().catch(() => {});
	}, [showTrigger]);
	const excerpt = visibleBlock ? getBlockText(visibleBlock).trim().slice(0, LABEL_EXCERPT) : "";
	// 服务端渲染出的按钮会在样式随懒加载模块到位之前露在正文左上角，只在浏览器里渲染。
	if (!hydrated) return null;
	return (
		<>
			{showTrigger && !below && (
				<div
					data-trigger-rail
					aria-hidden="true"
					style={{ top, height }}
					onMouseEnter={enterEntry}
					onMouseLeave={leaveEntry}
					className="annotation-trigger-rail pointer-events-auto absolute"
				/>
			)}
			<button
				ref={buttonRef}
				type="button"
				style={{ top, left: inlineLeft ?? undefined }}
				tabIndex={hasBlocks ? 0 : -1}
				onMouseEnter={enterEntry}
				onMouseLeave={leaveEntry}
				onFocus={onFocus}
				onBlur={onBlur}
				onKeyDown={onKeyDown}
				onTouchEnd={onTouchEnd}
				onClick={(event) => open(event.detail === 0)}
				aria-label={excerpt ? `发表段评：${excerpt}` : "发表段评"}
				aria-keyshortcuts="ArrowUp ArrowDown"
				title="发表段评（聚焦后用上下方向键切换段落）"
				data-show={showTrigger ? "true" : undefined}
				data-placement={touch ? "below" : undefined}
				className="annotation-trigger pointer-events-auto absolute"
			>
				<MessageSquareText {...iconProps(14)} />
			</button>
			{composerBlock && (
				<Popover.Root open onOpenChange={(next) => !next && close()}>
					<Popover.Anchor virtualRef={{ current: composerBlock }} />
					<AnnotationPortal>
						<Popover.Content
							asChild
							className="annotation-card annotation-block-composer v-float pointer-events-auto z-50 outline-none"
							align="end"
							side="bottom"
							sideOffset={COMPOSER_GAP_PX}
							collisionPadding={16}
							onOpenAutoFocus={(event) => event.preventDefault()}
							onCloseAutoFocus={(event) => {
								event.preventDefault();
								if (returnFocus.current) buttonRef.current?.focus();
							}}
							onInteractOutside={(event) => {
								// 聚焦移动不算离开；真正的外部按下才收起
								if (event.detail.originalEvent.type === "focusin")
									event.preventDefault();
							}}
							inert={!composerVisible}
							aria-hidden={!composerVisible || undefined}
							data-offscreen={!composerVisible ? "true" : undefined}
							aria-label="发表段评"
						>
							<AnnotationCardFrame>
								<AnnotationOverlayContext value={composerVisible}>
									<AnnotationQuote>{getBlockText(composerBlock)}</AnnotationQuote>
									<DeferredContent
										defer={false}
										load={loadBlockComposer}
										label="段评表单"
										fallback={
											<AnnotationPending
												label="正在准备段评…"
												className="h-8 pointer-coarse:h-9"
											/>
										}
										componentProps={{
											block: composerBlock,
											postId,
											isLoggedIn,
											onClose: close,
											autoFocus: true,
										}}
									/>
								</AnnotationOverlayContext>
							</AnnotationCardFrame>
						</Popover.Content>
					</AnnotationPortal>
				</Popover.Root>
			)}
		</>
	);
}

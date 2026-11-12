import { DeferredContent } from "@shared/ui/deferred-content/DeferredContent";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useBrushColors } from "../hooks/use-brush-colors";
import { useAnnotationMarks } from "../hooks/useAnnotationMarks";
import type { AnnotationAuthorFilter, BlockCount } from "../model/types";
import { AnnotationMarker } from "./AnnotationMarker";
import type { AnnotationPopoverTarget } from "./AnnotationPopover";
import { BlockCommentTrigger } from "./BlockCommentTrigger";
import { SelectionHighlight } from "./SelectionHighlight";
import { useExclusivePanel } from "./use-exclusive-panel";
import "@entities/comment/ui/ai-personas.css";
import "./annotations.css";

const loadAnnotationPopover = () =>
	import("./AnnotationPopover").then((module) => ({ default: module.AnnotationPopover }));

/** 划线高亮 mark 的 class。 */
const MARK_CLASS = "annotation-mark";
/** 角标容器的 data 属性，值为 blockId（外部点击判定与批注卡定位反查） */
const MARKER_DATA_BLOCKID = "data-annotation-blockid";
/** 角标纵向对齐块首行的偏移，px */
const MARKER_TOP_OFFSET_PX = 2;
const MARKER_MOBILE_HEIGHT_PX = 40;

/** 正文页边角标与按需批注卡的展示上下文。 */
export interface AnnotationLayerProps {
	/** 正文容器 ref */
	contentRef: React.RefObject<HTMLElement | null>;
	/** 批注按块聚合计数（轻量，不含正文） */
	summary: BlockCount[];
	/** 文章 id（透传给批注卡里的输入框） */
	postId?: string;
	/** 是否登录（决定回复入口与段评入口） */
	isLoggedIn?: boolean;
}

function sameAuthorFilter(a: AnnotationAuthorFilter, b: AnnotationAuthorFilter): boolean {
	if (a === null || b === null) return a === b;
	return a.name === b.name && a.is_ai === b.is_ai;
}

/** 当前展开的批注卡：从划线打开（带区间）或从页边角标打开（整段，区间为 null）。 */
interface ActivePopover {
	blockId: string;
	/** 划线区间的分组键；null 表示从页边角标打开的整段批注卡 */
	rangeKey: string | null;
	/** 整段批注卡的评论者筛选；null 显示全部 */
	author: AnnotationAuthorFilter;
	sessionId: number;
	/** 批注卡的定位参照：被点的划线或固定尺寸的角标组 */
	anchorEl: HTMLElement;
	/** 从划线打开时，关闭后还焦点的划线按钮 */
	returnFocusEl: HTMLElement | null;
}

/**
 * 显示不进入正文文本的页边角标，让角标与划线按需打开批注卡。
 *
 * @remarks 桌面角标位于侧边，移动端使用块内预留的段尾空间。
 */
export function AnnotationLayer({
	contentRef,
	summary,
	postId,
	isLoggedIn = false,
}: AnnotationLayerProps) {
	useBrushColors();
	const [active, setActive] = useState<ActivePopover | null>(null);
	const sessionCounter = useRef(0);
	/** 关闭动画期间批注卡仍需内容，保留最近一次的选择 */
	const lastActive = useRef<ActivePopover | null>(null);
	if (active) lastActive.current = active;
	const markerMap = useAnnotationMarks(contentRef, summary);
	/** blockId → 角标相对覆盖层的纵向位置（px） */
	const [positions, setPositions] = useState<Map<string, number>>(new Map());
	const layerRef = useRef<HTMLDivElement>(null);
	const annotatedBlocks = useMemo(() => new Set(markerMap.values()), [markerMap]);

	// 移动端只给有批注的块预留段尾入口；按钮仍在覆盖层，不进入正文选区。
	useEffect(() => {
		const root = contentRef.current;
		const layer = layerRef.current;
		if (!root || !layer || markerMap.size === 0) {
			setPositions(new Map());
			return;
		}
		let frame = 0;
		for (const el of markerMap.values()) el.classList.add("annotation-block-with-comments");
		const measure = () => {
			frame = 0;
			const layerTop = layer.getBoundingClientRect().top;
			const mobile = window.matchMedia("(max-width: 767.98px)").matches;
			const next = new Map<string, number>();
			for (const [blockId, el] of markerMap) {
				const rect = el.getBoundingClientRect();
				next.set(
					blockId,
					mobile
						? rect.bottom - layerTop - MARKER_MOBILE_HEIGHT_PX
						: rect.top - layerTop + MARKER_TOP_OFFSET_PX,
				);
			}
			setPositions((prev) => {
				if (prev.size === next.size && [...next].every(([k, v]) => prev.get(k) === v))
					return prev;
				return next;
			});
		};
		const schedule = () => {
			if (frame === 0) frame = requestAnimationFrame(measure);
		};
		const observer = new ResizeObserver(schedule);
		observer.observe(root);
		schedule();
		return () => {
			observer.disconnect();
			for (const el of markerMap.values())
				el.classList.remove("annotation-block-with-comments");
			if (frame !== 0) cancelAnimationFrame(frame);
		};
	}, [contentRef, markerMap]);

	const close = useCallback(() => setActive(null), []);
	useExclusivePanel("popover", active !== null, close);

	/** 点角标头像或划线：同一目标再点一次收起，否则切换到新目标 */
	const toggle = useCallback(
		(
			blockId: string,
			rangeKey: string | null,
			author: AnnotationAuthorFilter,
			anchorEl: HTMLElement,
			returnFocusEl: HTMLElement | null,
		) => {
			const sessionId = ++sessionCounter.current;
			setActive((cur) =>
				cur &&
				cur.blockId === blockId &&
				cur.rangeKey === rangeKey &&
				sameAuthorFilter(cur.author, author) &&
				cur.anchorEl === anchorEl
					? null
					: {
							blockId,
							rangeKey,
							author,
							anchorEl,
							returnFocusEl,
							sessionId: cur?.sessionId ?? sessionId,
						},
			);
		},
		[],
	);

	// 划线是按钮：点击与 Enter、空格都打开该划线的批注卡，贴着被点的那一段定位。
	useEffect(() => {
		const root = contentRef.current;
		if (!root) return;
		const open = (target: EventTarget | null) => {
			const mark = (target as Element | null)?.closest<HTMLElement>(`mark.${MARK_CLASS}`);
			const blockId = mark?.dataset.annotationBlock;
			const rangeKey = mark?.dataset.annotationRange;
			if (!mark || !blockId || !rangeKey) return;
			const button = root.querySelector<HTMLElement>(
				`mark.${MARK_CLASS}[data-annotation-button][data-annotation-block="${blockId}"][data-annotation-range="${rangeKey}"]`,
			);
			toggle(blockId, rangeKey, null, mark, button);
		};
		const onClick = (event: MouseEvent) => open(event.target);
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key !== "Enter" && event.key !== " ") return;
			const target = event.target as Element | null;
			if (!target?.matches(`mark.${MARK_CLASS}[data-annotation-button]`)) return;
			event.preventDefault();
			open(target);
		};
		root.addEventListener("click", onClick);
		root.addEventListener("keydown", onKeyDown);
		return () => {
			root.removeEventListener("click", onClick);
			root.removeEventListener("keydown", onKeyDown);
		};
	}, [contentRef, toggle]);

	// 被打开的划线加深，其按钮同步展开态。
	// biome-ignore lint/correctness/useExhaustiveDependencies: markerMap 换新表示划线已重建，须重新标记
	useEffect(() => {
		const root = contentRef.current;
		if (!root) return;
		for (const mark of root.querySelectorAll<HTMLElement>(`mark.${MARK_CLASS}`)) {
			const on =
				active?.rangeKey != null &&
				mark.dataset.annotationBlock === active.blockId &&
				mark.dataset.annotationRange === active.rangeKey;
			if (on) mark.dataset.active = "true";
			else delete mark.dataset.active;
			if (mark.dataset.annotationButton) mark.setAttribute("aria-expanded", String(on));
		}
	}, [contentRef, active, markerMap]);

	const summaryByBlock = useMemo(() => new Map(summary.map((b) => [b.block_id, b])), [summary]);
	const target = active ?? lastActive.current;
	const block = target ? summaryByBlock.get(target.blockId) : undefined;

	/** 最近解析成功的划线节点；重划间隙里旧节点已脱离文档时顶一帧。 */
	const lastResolvedAnchor = useRef<HTMLElement | null>(null);
	/** 回复或刷新会重建划线（旧 mark 节点被替换）；按块与区间重新解析定位参照，面板不漂到视口左上角。 */
	const resolveAnchorEl = (current: ActivePopover): HTMLElement => {
		if (current.rangeKey != null) {
			// blockId 是 8 位十六进制、rangeKey 形如 "12:34"，都无需 CSS 转义
			const mark = contentRef.current?.querySelector<HTMLElement>(
				`mark.${MARK_CLASS}[data-annotation-block="${current.blockId}"][data-annotation-range="${current.rangeKey}"]`,
			);
			if (mark) {
				lastResolvedAnchor.current = mark;
				return mark;
			}
		}
		if (current.anchorEl.isConnected) return current.anchorEl;
		if (lastResolvedAnchor.current?.isConnected) return lastResolvedAnchor.current;
		return markerMap.get(current.blockId) ?? current.anchorEl;
	};

	const popoverTarget: AnnotationPopoverTarget | null =
		target && block
			? {
					blockId: target.blockId,
					rangeKey: target.rangeKey,
					sessionId: target.sessionId,
					author: target.author,
					anchorEl: resolveAnchorEl(target),
					returnFocusEl: target.returnFocusEl,
					blockEl: markerMap.get(target.blockId) ?? null,
					authors: block.authors ?? [],
					count: block.count,
				}
			: null;

	return (
		<>
			<SelectionHighlight contentRef={contentRef} />
			<div ref={layerRef} className="pointer-events-none absolute inset-x-0 top-0 h-0">
				<BlockCommentTrigger
					contentRef={contentRef}
					layerRef={layerRef}
					annotatedBlocks={annotatedBlocks}
					isLoggedIn={isLoggedIn}
					postId={postId ?? ""}
				/>
				{summary.map((item) => {
					const top = positions.get(item.block_id);
					if (top === undefined) return null;
					return (
						<AnnotationMarker
							key={item.block_id}
							block={item}
							top={top}
							activeAuthor={
								active?.blockId === item.block_id && active.rangeKey === null
									? active.author
									: undefined
							}
							onSelect={(author, el) =>
								toggle(
									item.block_id,
									null,
									author,
									el.closest<HTMLElement>(`[${MARKER_DATA_BLOCKID}]`) ?? el,
									null,
								)
							}
						/>
					);
				})}
			</div>
			{target && (
				<DeferredContent
					defer={false}
					load={loadAnnotationPopover}
					label="批注详情"
					fallback={null}
					componentProps={{
						open: active !== null,
						target: popoverTarget,
						postId: postId ?? "",
						isLoggedIn,
						onFilter: (author: AnnotationAuthorFilter) =>
							setActive((cur) => (cur ? { ...cur, author } : cur)),
						onClose: close,
					}}
				/>
			)}
		</>
	);
}

export default AnnotationLayer;

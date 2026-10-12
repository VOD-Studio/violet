/** 角标不进入正文文本；桌面放在侧边，移动端使用块内预留的段尾空间。 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAnnotationMarks } from "../hooks/useAnnotationMarks";
import type { AnnotationAuthorFilter, BlockCount } from "../model/types";
import { AnnotationMarker } from "./AnnotationMarker";
import { AnnotationPopover, type AnnotationPopoverTarget } from "./AnnotationPopover";
import { BlockCommentTrigger } from "./BlockCommentTrigger";
import { useExclusivePanel } from "./use-exclusive-panel";
import "@entities/comment/ui/ai-personas.css";
import "./annotations.css";

/** 划线高亮 mark 的 class。 */
const MARK_CLASS = "annotation-mark";
/** 角标容器的 data 属性，值为 blockId（外部点击判定与高亮点击反查角标） */
const MARKER_DATA_BLOCKID = "data-annotation-blockid";
/** 角标纵向对齐块首行的偏移，px */
const MARKER_TOP_OFFSET_PX = 2;
const MARKER_MOBILE_HEIGHT_PX = 32;

export interface AnnotationLayerProps {
	/** 正文容器 ref */
	contentRef: React.RefObject<HTMLElement | null>;
	/** 批注按块聚合计数（轻量，不含正文） */
	summary: BlockCount[];
	/** 文章 id（透传给气泡内的回复表单） */
	postId?: string;
	/** 是否登录（决定回复入口与段评入口） */
	isLoggedIn?: boolean;
}

function sameAuthorFilter(a: AnnotationAuthorFilter, b: AnnotationAuthorFilter): boolean {
	if (a === null || b === null) return a === b;
	return a.name === b.name && a.is_ai === b.is_ai;
}

/** 当前展开气泡的选择：块 + 评论者筛选，触发元素用于定位 */
interface ActivePopover {
	blockId: string;
	author: AnnotationAuthorFilter;
	anchorEl: HTMLElement;
}

export function AnnotationLayer({
	contentRef,
	summary,
	postId,
	isLoggedIn = false,
}: AnnotationLayerProps) {
	const [active, setActive] = useState<ActivePopover | null>(null);
	/** 关闭动画期间气泡仍需内容，保留最近一次的选择 */
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

	/** 点击头像或高亮：同一目标再点一次收起，否则切换到新目标 */
	const toggle = useCallback(
		(blockId: string, author: AnnotationAuthorFilter, anchorEl: HTMLElement) => {
			setActive((cur) =>
				cur &&
				cur.blockId === blockId &&
				sameAuthorFilter(cur.author, author) &&
				cur.anchorEl === anchorEl
					? null
					: { blockId, author, anchorEl },
			);
		},
		[],
	);

	// 点击划线高亮：打开该块的批注气泡，贴着该块的角标头像定位
	useEffect(() => {
		const root = contentRef.current;
		if (!root) return;
		const onClick = (event: MouseEvent) => {
			const mark = (event.target as Element | null)?.closest<HTMLElement>(
				`mark.${MARK_CLASS}`,
			);
			const blockId = mark?.dataset.annotationBlock;
			if (!mark || !blockId) return;
			const marker = layerRef.current?.querySelector<HTMLElement>(
				`[${MARKER_DATA_BLOCKID}="${blockId}"]`,
			);
			toggle(blockId, null, marker ?? mark);
		};
		root.addEventListener("click", onClick);
		return () => root.removeEventListener("click", onClick);
	}, [contentRef, toggle]);

	const summaryByBlock = useMemo(() => new Map(summary.map((b) => [b.block_id, b])), [summary]);
	const target = active ?? lastActive.current;
	const block = target ? summaryByBlock.get(target.blockId) : undefined;
	const popoverTarget: AnnotationPopoverTarget | null =
		target && block
			? {
					blockId: target.blockId,
					author: target.author,
					anchorEl: target.anchorEl,
					authors: block.authors ?? [],
					count: block.count,
				}
			: null;

	return (
		<>
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
								active?.blockId === item.block_id ? active.author : undefined
							}
							onSelect={(author, el) =>
								toggle(
									item.block_id,
									author,
									el.closest<HTMLElement>(`[${MARKER_DATA_BLOCKID}]`) ?? el,
								)
							}
						/>
					);
				})}
			</div>
			<AnnotationPopover
				open={active !== null}
				target={popoverTarget}
				postId={postId ?? ""}
				isLoggedIn={isLoggedIn}
				onFilter={(author) => setActive((cur) => (cur ? { ...cur, author } : cur))}
				onClose={close}
			/>
		</>
	);
}

export default AnnotationLayer;

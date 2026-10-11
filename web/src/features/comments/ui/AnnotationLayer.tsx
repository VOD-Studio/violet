/**
 * AnnotationLayer - 正文批注角标 + 头像气泡（懒加载版）。
 *
 * 角标是正文右侧边距里的绝对定位覆盖层（评论者头像），不注入段落 DOM，
 * 不改变正文流式布局，加载批注与图片撑高页面都不会让文字位移。
 *
 * 点击某位评论者的头像（或正文里的划线高亮），在该处淡入气泡，列出对应批注；
 * 气泡内容按 block_id 懒加载（含 replies 预览）。
 */
import { avatarUrl } from "@shared/lib/image-url";
import { cn } from "cn";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { extractCandidateBlocks, findBlockElement, getBlockText } from "../lib/extract-blocks";
import { clearMarks, wrapRange } from "../lib/range-marks";
import type { BlockAuthor, BlockCount } from "../model/types";
import { AnnotationPopover, type AnnotationPopoverTarget } from "./AnnotationPopover";
import { BlockCommentTrigger } from "./BlockCommentTrigger";
import { useExclusivePanel } from "./use-exclusive-panel";
import "./annotations.css";

/** 划线高亮 mark 的 class（荧光笔底色） */
const MARK_CLASS = "annotation-mark";
/** 角标容器的 data 属性，值为 blockId（外部点击判定与高亮点击反查角标） */
const MARKER_DATA_BLOCKID = "data-annotation-blockid";
/** 角标纵向对齐块首行的偏移，px */
const MARKER_TOP_OFFSET_PX = 2;
/** 角标最多并排显示的头像数，其余折叠为 +N */
const MARKER_AVATAR_MAX = 3;

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

/** 当前展开气泡的选择：块 + 评论者筛选，触发元素用于定位 */
interface ActivePopover {
	blockId: string;
	author: string | null;
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
	/** 有批注的 blockId → 正文块 DOM 元素 */
	const [markerMap, setMarkerMap] = useState<Map<string, HTMLElement>>(new Map());
	/** blockId → 角标相对覆盖层的纵向位置（px） */
	const [positions, setPositions] = useState<Map<string, number>>(new Map());
	const layerRef = useRef<HTMLDivElement>(null);
	const annotatedBlocks = useMemo(() => new Set(markerMap.values()), [markerMap]);

	// 1. 按 summary 中的 block_id 找对应 DOM 元素并给划线区间涂荧光笔。
	useEffect(() => {
		const root = contentRef.current;
		if (!root) {
			setMarkerMap(new Map());
			return;
		}

		clearMarks(root, MARK_CLASS);

		if (summary.length === 0) {
			setMarkerMap(new Map());
			return;
		}

		let cancelled = false;
		(async () => {
			// 先确保 DOM 元素有 blockId（extractCandidateBlocks 做 hash 计算，
			// findBlockElement 同样靠 hash 定位）
			await extractCandidateBlocks(root);
			if (cancelled) return;

			const nextMap = new Map<string, HTMLElement>();
			for (const { block_id, ranges } of summary) {
				if (cancelled) return;
				const el = await findBlockElement(root, block_id);
				if (el && !cancelled) {
					// 覆盖全块的区间是整段评论，由头像角标表示，不再整段涂色
					const length = getBlockText(el).length;
					for (const range of ranges ?? []) {
						if (range.start <= 0 && range.end >= length) continue;
						wrapRange(el, range, MARK_CLASS, { annotationBlock: block_id });
					}
					nextMap.set(block_id, el);
				}
			}
			if (cancelled) return;
			setMarkerMap(nextMap);
		})();

		return () => {
			cancelled = true;
			clearMarks(root, MARK_CLASS);
		};
	}, [contentRef, summary]);

	// 2. 按块位置布置角标。正文尺寸变化（图片/字体加载、窗口缩放）时重算，
	// 只写覆盖层状态，不触碰正文 DOM。
	useEffect(() => {
		const root = contentRef.current;
		const layer = layerRef.current;
		if (!root || !layer || markerMap.size === 0) {
			setPositions(new Map());
			return;
		}
		let frame = 0;
		const measure = () => {
			frame = 0;
			const layerTop = layer.getBoundingClientRect().top;
			const next = new Map<string, number>();
			for (const [blockId, el] of markerMap) {
				next.set(blockId, el.getBoundingClientRect().top - layerTop + MARKER_TOP_OFFSET_PX);
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
			if (frame !== 0) cancelAnimationFrame(frame);
		};
	}, [contentRef, markerMap]);

	const close = useCallback(() => setActive(null), []);
	useExclusivePanel("popover", active !== null, close);

	/** 点击头像或高亮：同一目标再点一次收起，否则切换到新目标 */
	const toggle = useCallback((blockId: string, author: string | null, anchorEl: HTMLElement) => {
		setActive((cur) =>
			cur && cur.blockId === blockId && cur.author === author && cur.anchorEl === anchorEl
				? null
				: { blockId, author, anchorEl },
		);
	}, []);

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
				`[${MARKER_DATA_BLOCKID}="${blockId}"] button`,
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
							onSelect={(author, el) => toggle(item.block_id, author, el)}
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

/**
 * AnnotationMarker - 段落右侧的批注角标：评论者头像，逐个可点。
 *
 * lg 以上落在正文右侧边距，最多并排 3 位头像，其余折叠为 +N；窄屏边距只有一条细槽，
 * 退化为首位评论者的单枚头像。无评论者信息时回退为带评论数的圆标。
 */
function AnnotationMarker({
	block,
	top,
	activeAuthor,
	onSelect,
}: {
	block: BlockCount;
	top: number;
	/** undefined：该块气泡未展开；null：展开且显示全部；string：展开且只看该评论者 */
	activeAuthor: string | null | undefined;
	onSelect: (author: string | null, anchorEl: HTMLElement) => void;
}) {
	const authors = block.authors ?? [];
	const shown = authors.slice(0, MARKER_AVATAR_MAX);
	const extra = authors.length - shown.length;
	const label = `${block.count} 条批注`;
	return (
		<div
			{...{ [MARKER_DATA_BLOCKID]: block.block_id }}
			style={{ top }}
			className="annotation-marker pointer-events-auto absolute"
		>
			{authors.length === 0 ? (
				<button
					type="button"
					aria-label={label}
					title={label}
					onClick={(e) => onSelect(null, e.currentTarget)}
					className="annotation-avatar"
					data-active={activeAuthor !== undefined ? "true" : undefined}
				>
					{block.count}
				</button>
			) : (
				shown.map((author) => (
					<MarkerAvatar
						key={author.name}
						author={author}
						active={activeAuthor === author.name}
						onClick={(el) => onSelect(author.name, el)}
					/>
				))
			)}
			{extra > 0 && (
				<button
					type="button"
					aria-label={label}
					title={label}
					onClick={(e) => onSelect(null, e.currentTarget)}
					className="annotation-avatar"
					data-active={activeAuthor === null ? "true" : undefined}
				>
					+{extra}
				</button>
			)}
		</div>
	);
}

function MarkerAvatar({
	author,
	active,
	onClick,
}: {
	author: BlockAuthor;
	active: boolean;
	onClick: (anchorEl: HTMLElement) => void;
}) {
	return (
		<button
			type="button"
			aria-label={`${author.name} 的批注`}
			title={author.name}
			onClick={(e) => onClick(e.currentTarget)}
			className={cn("annotation-avatar")}
			data-active={active ? "true" : undefined}
		>
			{author.avatar_url ? (
				<img src={avatarUrl(author.avatar_url, author.name)} alt="" loading="lazy" />
			) : (
				author.name.slice(0, 1).toUpperCase()
			)}
		</button>
	);
}

export default AnnotationLayer;

/**
 * AnnotationLayer - 正文批注角标 + 头像气泡（懒加载版）。
 *
 * 角标是正文右侧边距里的绝对定位覆盖层（评论者头像），不注入段落 DOM，
 * 不改变正文流式布局，加载批注与图片撑高页面都不会让文字位移。
 *
 * 点击某位评论者的头像（或正文里的划线高亮），在该处淡入气泡，列出对应批注；
 * 气泡内容按 block_id 懒加载（含 replies 预览）。
 */
import { AIBadge } from "@entities/comment/ui/AIBadge";
import { avatarUrl } from "@shared/lib/image-url";
import { cn } from "cn";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { computeBlockId } from "../lib/block-id";
import { extractCandidateBlocks, findBlockElement, getBlockText } from "../lib/extract-blocks";
import { clearMarks, mapLegacyRangeToCarrier, wrapRange } from "../lib/range-marks";
import type { AnnotationAuthorFilter, BlockAuthor, BlockCount } from "../model/types";
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

function sameAuthorFilter(a: AnnotationAuthorFilter, b: AnnotationAuthorFilter): boolean {
	if (a === null || b === null) return a === b;
	return a.name === b.name && a.is_ai === b.is_ai;
}

function authorIdentityKey(a: { name: string; is_ai?: boolean }): string {
	return `${a.is_ai ? "ai" : "user"}:${a.name}`;
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
	/** 有批注的 blockId → 正文块 DOM 元素 */
	const [markerMap, setMarkerMap] = useState<Map<string, HTMLElement>>(new Map());
	/** blockId → 角标相对覆盖层的纵向位置（px） */
	const [positions, setPositions] = useState<Map<string, number>>(new Map());
	const layerRef = useRef<HTMLDivElement>(null);
	const annotatedBlocks = useMemo(() => new Set(markerMap.values()), [markerMap]);

	// 1. 按 summary 中的 block_id 找对应 DOM 元素并给划线区间涂荧光笔。
	// KaTeX 懒加载会先走 Suspense 纯 LaTeX fallback，此时 textContent===carrier，
	// 历史 KaTeX hash 无法命中；公式 chunk 挂载后再跑一轮（MutationObserver）。
	useEffect(() => {
		const root = contentRef.current;
		if (!root) {
			setMarkerMap(new Map());
			return;
		}

		if (summary.length === 0) {
			clearMarks(root, MARK_CLASS);
			setMarkerMap(new Map());
			return;
		}

		let cancelled = false;
		let applyingMarks = false;
		let pendingFormulaMutation = false;
		let debounceTimer = 0;
		let runGeneration = 0;

		const applyMarks = async () => {
			const generation = ++runGeneration;
			await extractCandidateBlocks(root);
			if (cancelled || generation !== runGeneration) return;

			const nextMap = new Map<string, HTMLElement>();
			applyingMarks = true;
			try {
				clearMarks(root, MARK_CLASS);
				for (const { block_id, ranges } of summary) {
					if (cancelled || generation !== runGeneration) return;
					const el = await findBlockElement(root, block_id);
					if (!el || cancelled || generation !== runGeneration) continue;
					const carrier = getBlockText(el);
					const carrierId = await computeBlockId(carrier);
					// block_id 命中 legacyId 时，摘要区间仍是旧 textContent 坐标，先按 DOM 映射到 carrier
					const legacyMatch = carrierId !== null && carrierId !== block_id;
					const length = carrier.length;
					for (const range of ranges ?? []) {
						const mapped = legacyMatch ? mapLegacyRangeToCarrier(el, range) : range;
						if (mapped.start <= 0 && mapped.end >= length) continue;
						wrapRange(el, mapped, MARK_CLASS, { annotationBlock: block_id });
					}
					nextMap.set(block_id, el);
				}
			} finally {
				queueMicrotask(() => {
					applyingMarks = false;
					if (pendingFormulaMutation && !cancelled) {
						pendingFormulaMutation = false;
						scheduleApply();
					}
				});
			}
			if (cancelled || generation !== runGeneration) return;
			setMarkerMap(nextMap);
		};

		const scheduleApply = () => {
			window.clearTimeout(debounceTimer);
			debounceTimer = window.setTimeout(() => {
				void applyMarks();
			}, 50);
		};

		void applyMarks();

		const mo = new MutationObserver((mutations) => {
			if (cancelled) return;
			const carrierDomChanged = mutations.some((m) => {
				for (const n of [...m.addedNodes, ...m.removedNodes]) {
					if (!(n instanceof Element)) continue;
					if (n.classList.contains(MARK_CLASS) || n.tagName === "MARK") continue;
					if (
						n.classList.contains("katex") ||
						n.classList.contains("katex-display") ||
						n.querySelector(".katex, .katex-display") ||
						n.getAttribute("data-type") === "inline-math" ||
						n.getAttribute("data-type") === "block-math" ||
						n.getAttribute("data-runnable") === "true" ||
						n.querySelector("[data-runnable='true']")
					) {
						return true;
					}
				}
				return false;
			});
			if (!carrierDomChanged) return;
			if (applyingMarks) {
				pendingFormulaMutation = true;
				return;
			}
			scheduleApply();
		});
		mo.observe(root, { childList: true, subtree: true });

		return () => {
			cancelled = true;
			window.clearTimeout(debounceTimer);
			mo.disconnect();
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
	/** undefined：该块气泡未展开；null：展开且显示全部；对象：展开且只看该身份 */
	activeAuthor: AnnotationAuthorFilter | undefined;
	onSelect: (author: AnnotationAuthorFilter, anchorEl: HTMLElement) => void;
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
						key={authorIdentityKey(author)}
						author={author}
						active={
							activeAuthor != null &&
							sameAuthorFilter(activeAuthor, {
								name: author.name,
								is_ai: !!author.is_ai,
							})
						}
						onClick={(el) => onSelect({ name: author.name, is_ai: !!author.is_ai }, el)}
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
	const label = author.is_ai ? `${author.name}（AI）的批注` : `${author.name} 的批注`;
	return (
		<button
			type="button"
			aria-label={label}
			title={label}
			onClick={(e) => onClick(e.currentTarget)}
			className={cn("annotation-avatar", "relative")}
			data-active={active ? "true" : undefined}
			data-ai={author.is_ai ? "true" : undefined}
		>
			{author.avatar_url ? (
				<img src={avatarUrl(author.avatar_url, author.name)} alt="" loading="lazy" />
			) : (
				author.name.slice(0, 1).toUpperCase()
			)}
			{author.is_ai ? (
				<span className="pointer-events-none absolute -right-0.5 -bottom-0.5 scale-75">
					<AIBadge show />
				</span>
			) : null}
		</button>
	);
}

export default AnnotationLayer;

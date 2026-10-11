/**
 * AnnotationLayer - 正文批注角标 + 气泡面板（懒加载版）。
 *
 * 角标是正文右侧边距里的绝对定位覆盖层（评论者头像组），不注入段落 DOM，
 * 不改变正文流式布局，加载批注与图片撑高页面都不会让文字位移。
 *
 * 面板方案：点击角标展开批注列表面板，fixed 钉视口右侧（2xl+）或居中（lg 以下），
 * 不占文档流、不挤压正文。面板内容按 block_id 懒加载（含 replies 预览）。
 *
 * AnnotationLayer 也负责给批注块加高亮 class（视觉标记「这段有批注」）。
 */
import { AvatarGroup } from "@shared/ui/avatar-group";
import { useCallback, useEffect, useRef, useState } from "react";
import { useBlockAnnotations } from "../api/queries";
import { extractCandidateBlocks, findBlockElement } from "../lib/extract-blocks";
import type { BlockCount } from "../model/types";
import { AnnotationCard } from "./AnnotationCard";
import "./annotations.css";

/** 高亮块的 class（淡底 + 虚线描边） */
const HIGHLIGHT_CLASS = "annotation-highlight";
/** 角标按钮的 data 属性，值为 blockId（面板定位时反查角标位置） */
const MARKER_DATA_BLOCKID = "data-annotation-blockid";
/** 角标纵向对齐块首行的偏移，px */
const MARKER_TOP_OFFSET_PX = 2;
/** 角标头像组最多显示的头像数 */
const MARKER_AVATAR_MAX = 3;
/**
 * STICKY_TOP_PX 面板粘性钉视口时的 top 偏移（与顶部阅读进度条/导航栏留白）。
 * 当角标向上滚出视口、其 rect.top 小于此值时，面板从「跟随角标」切换为「钉住」。
 */
const STICKY_TOP_PX = 96;

export interface AnnotationLayerProps {
	/** 正文容器 ref */
	contentRef: React.RefObject<HTMLElement | null>;
	/** 批注按块聚合计数（轻量，不含正文） */
	summary: BlockCount[];
	/** 文章 id（透传给 AnnotationCard 的回复表单） */
	postId?: string;
	/** 是否登录（透传给 AnnotationCard，决定是否显示回复按钮） */
	isLoggedIn?: boolean;
}

export function AnnotationLayer({
	contentRef,
	summary,
	postId,
	isLoggedIn = false,
}: AnnotationLayerProps) {
	const [, forceRender] = useState(0);
	const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
	const [panelVisible, setPanelVisible] = useState(false);
	/** 面板当前 top（视口坐标，px）。null 表示用默认 sticky 顶部。 */
	const [panelTop, setPanelTop] = useState<number | null>(null);
	/** 有批注的 blockId → 正文块 DOM 元素 */
	const [markerMap, setMarkerMap] = useState<Map<string, HTMLElement>>(new Map());
	/** blockId → 角标相对覆盖层的纵向位置（px） */
	const [positions, setPositions] = useState<Map<string, number>>(new Map());
	const layerRef = useRef<HTMLDivElement>(null);

	// 1. 按 summary 中的 block_id 找对应 DOM 元素并加高亮 class。
	useEffect(() => {
		const root = contentRef.current;
		if (!root) {
			setMarkerMap(new Map());
			forceRender((n) => n + 1);
			return;
		}

		// 清理旧高亮
		root.querySelectorAll(`.${HIGHLIGHT_CLASS}`).forEach((el) => {
			el.classList.remove(HIGHLIGHT_CLASS);
		});

		if (summary.length === 0) {
			setMarkerMap(new Map());
			forceRender((n) => n + 1);
			return;
		}

		let cancelled = false;
		(async () => {
			// 先确保 DOM 元素有 blockId（extractCandidateBlocks 做 hash 计算，
			// findBlockElement 同样靠 hash 定位）
			await extractCandidateBlocks(root);
			if (cancelled) return;

			const nextMap = new Map<string, HTMLElement>();
			for (const { block_id } of summary) {
				if (cancelled) return;
				const el = await findBlockElement(root, block_id);
				if (el && !cancelled) {
					el.classList.add(HIGHLIGHT_CLASS);
					nextMap.set(block_id, el);
				}
			}
			if (cancelled) return;
			setMarkerMap(nextMap);
			forceRender((n) => n + 1);
		})();

		return () => {
			cancelled = true;
			root.querySelectorAll(`.${HIGHLIGHT_CLASS}`).forEach((el) => {
				el.classList.remove(HIGHLIGHT_CLASS);
			});
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

	/** 读取指定 blockId 对应角标的视口位置，更新 panelTop */
	const updatePanelTopForBlock = useCallback((blockId: string) => {
		const markerEl = layerRef.current?.querySelector(`[${MARKER_DATA_BLOCKID}="${blockId}"]`);
		if (!markerEl) return;
		const rect = markerEl.getBoundingClientRect();
		setPanelTop(rect.top > STICKY_TOP_PX ? rect.top : STICKY_TOP_PX);
	}, []);

	/** 点击角标：展开/收起面板。展开瞬间把面板顶部对齐到角标水平线。 */
	const handleMarkerClickById = useCallback(
		(blockId: string) => {
			setActiveBlockId((cur) => {
				const next = cur === blockId ? null : blockId;
				setPanelVisible(next !== null);
				// 初次展开：面板 top 跟随角标（同一水平线）；收起时复位为 null。
				if (next !== null) {
					// 在下一帧读取 marker 元素位置（此时 markerMap 可能尚未更新到最新渲染）
					requestAnimationFrame(() => {
						updatePanelTopForBlock(next);
					});
				} else {
					setPanelTop(null);
				}
				return next;
			});
		},
		[updatePanelTopForBlock],
	);

	// 滚动跟随：角标在视口内时面板 top 跟角标同水平线；
	// 角标滚到 STICKY_TOP_PX 以上（即将滚出顶部）时面板粘性钉住；
	// 角标滚出视口底部时面板也粘性钉住（避免面板跟着飞下去）。
	// 用 rAF 节流，避免 scroll 高频触发 setState。
	useEffect(() => {
		if (!activeBlockId || !panelVisible) return;
		const markerEl = layerRef.current?.querySelector(
			`[${MARKER_DATA_BLOCKID}="${activeBlockId}"]`,
		);
		if (!markerEl) return;

		let rafId = 0;
		const update = () => {
			rafId = 0;
			const rect = markerEl.getBoundingClientRect();
			setPanelTop(rect.top > STICKY_TOP_PX ? rect.top : STICKY_TOP_PX);
		};
		const onScroll = () => {
			if (rafId === 0) rafId = requestAnimationFrame(update);
		};
		window.addEventListener("scroll", onScroll, { passive: true });
		update(); // 立即同步一次，避免首帧闪烁
		return () => {
			window.removeEventListener("scroll", onScroll);
			if (rafId !== 0) cancelAnimationFrame(rafId);
		};
	}, [activeBlockId, panelVisible]);

	// 当前展开块的批注计数（用于 header 标题）
	const activeCount = activeBlockId
		? (summary.find((s) => s.block_id === activeBlockId)?.count ?? 0)
		: 0;

	return (
		<>
			<div ref={layerRef} className="pointer-events-none absolute inset-x-0 top-0 h-0">
				{summary.map((block) => {
					const top = positions.get(block.block_id);
					if (top === undefined) return null;
					return (
						<AnnotationMarker
							key={block.block_id}
							block={block}
							top={top}
							active={activeBlockId === block.block_id}
							onClick={() => handleMarkerClickById(block.block_id)}
						/>
					);
				})}
			</div>
			{/* 批注列表面板：点角标后展开。
                定位策略（与角标同水平线起跳 + 顶部粘性）：
                  - panelTop 状态由滚动监听更新：角标 rect.top > STICKY_TOP_PX 时跟随角标顶部；
                    角标滚到 STICKY_TOP_PX 以上时钉住，避免面板跟着滚出视口。
                  - 2xl+ 钉右侧空白区（right-4），lg 以下居中（translate-x-1/2）。
                  - top 用 inline style（优先级覆盖 Tailwind 断点），左右用 Tailwind 断点。 */}
			{activeBlockId && panelVisible && (
				<AnnotationPanel
					postId={postId ?? ""}
					blockId={activeBlockId}
					count={activeCount}
					isLoggedIn={isLoggedIn}
					panelTop={panelTop ?? STICKY_TOP_PX}
					onClose={() => {
						setActiveBlockId(null);
						setPanelVisible(false);
					}}
				/>
			)}
		</>
	);
}

/**
 * AnnotationPanel - 批注面板（懒加载内容）
 *
 * 外层 div 设 max-h + overflow-hidden，header 用 sticky，内容区 overflow-y-auto。
 * 这样只有内容区滚动，header 固定。
 */
function AnnotationPanel({
	postId,
	blockId,
	count,
	isLoggedIn,
	panelTop,
	onClose,
}: {
	postId: string;
	blockId: string;
	count: number;
	isLoggedIn: boolean;
	panelTop: number;
	onClose: () => void;
}) {
	const blockQuery = useBlockAnnotations(postId, blockId);

	return (
		<div
			style={{ top: panelTop }}
			className={
				"fixed right-4 left-auto z-50 flex w-80 max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-lg border border-edge-hairline bg-card pt-3 shadow-xl " +
				"max-h-[calc(100vh-7.5rem)]"
			}
		>
			{/* sticky header */}
			<div className="flex shrink-0 items-center justify-between px-3 pb-2">
				<span className="text-xs font-medium text-muted-foreground">{count} 条批注</span>
				<button
					type="button"
					onClick={onClose}
					className="text-muted-foreground hover:text-foreground"
					aria-label="关闭"
				>
					×
				</button>
			</div>
			{/* 可滚动内容区：pl-3 左留白，pr-2 + scrollbar-gutter(4px) = 右留白 12px，左右对称 */}
			<div className="annotation-scroll min-h-0 flex-1 space-y-2 overflow-y-auto overflow-x-hidden pb-3 pl-3 pr-2 pt-0.5">
				{blockQuery.isLoading && <AnnotationSkeleton />}
				{blockQuery.data?.data.map((comment) => (
					<AnnotationCard
						key={comment.id}
						node={{
							comment,
							replies: (comment.replies ?? []).map((r) => ({
								comment: r,
								replies: [],
							})),
						}}
						selectedText={comment.anchor?.selected_text ?? ""}
						postId={postId}
						isLoggedIn={isLoggedIn}
					/>
				))}
			</div>
		</div>
	);
}

/** AnnotationSkeleton 骨架屏：简单的灰色卡片占位 */
function AnnotationSkeleton() {
	return (
		<div className="space-y-2">
			{[1, 2].map((i) => (
				<div key={i} className="rounded-xl border border-edge-hairline p-3">
					<div className="mb-2 h-3 w-2/3 animate-pulse rounded bg-muted" />
					<div className="mb-1 h-2 w-1/2 animate-pulse rounded bg-muted" />
					<div className="h-2 w-full animate-pulse rounded bg-muted" />
				</div>
			))}
		</div>
	);
}

/**
 * AnnotationMarker - 段落右侧的批注角标：评论者头像组。
 *
 * lg 以上落在正文右侧边距，最多 3 位头像叠放；窄屏边距只有一条细槽，
 * 退化为首位评论者的单枚头像。无评论者信息时回退为带评论数的气泡图标。
 */
function AnnotationMarker({
	block,
	top,
	active,
	onClick,
}: {
	block: BlockCount;
	top: number;
	active: boolean;
	onClick: () => void;
}) {
	const users = (block.authors ?? []).map((a) => ({
		username: a.name,
		avatar_url: a.avatar_url,
	}));
	const label = `${block.count} 条批注`;
	return (
		<button
			type="button"
			{...{ [MARKER_DATA_BLOCKID]: block.block_id }}
			aria-label={label}
			aria-expanded={active}
			title={label}
			style={{ top }}
			onClick={(e) => {
				e.stopPropagation();
				onClick();
			}}
			className="annotation-marker pointer-events-auto absolute"
			data-active={active ? "true" : undefined}
		>
			{users.length > 0 ? (
				<>
					<AvatarGroup users={users.slice(0, 1)} size="xs" className="lg:hidden" />
					<AvatarGroup
						users={users}
						size="xs"
						max={MARKER_AVATAR_MAX}
						className="hidden lg:flex"
					/>
				</>
			) : (
				<span className="annotation-marker-count">{block.count}</span>
			)}
		</button>
	);
}

export default AnnotationLayer;

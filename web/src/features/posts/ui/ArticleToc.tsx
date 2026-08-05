import { type TocItem, useActiveHeading } from "@shared/lib/hooks/use-toc";
import { ScrollArea } from "@shared/ui/scroll-area";
import { ChevronRight, MoreHorizontal } from "lucide-react";
import {
	type RefObject,
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";

export interface ArticleTocProps {
	items: TocItem[];
	/** 文章内容容器 ref，用于监听滚动与查找 heading */
	contentRef: RefObject<HTMLElement | null>;
	/** 点击某条目后的回调，移动端用于关闭 Sheet */
	onNavigate?: () => void;
	/** 隐藏内部 Contents 标题，外层已提供标题时使用 */
	hideTitle?: boolean;
	/** 强制进入 Focus 模式，移动端打开 Sheet 时使用 */
	forceFocus?: boolean;
}

export interface TocNode extends TocItem {
	children: TocNode[];
}

/** 每个层级的缩进与字号 */
const LEVEL_CONFIG: Record<2 | 3 | 4, { indent: string; text: string }> = {
	2: { indent: "pl-2", text: "text-sm" },
	3: { indent: "pl-5", text: "text-sm" },
	4: { indent: "pl-8", text: "text-xs" },
};

/** 上下文窗口中前后兄弟项数量 */
const SIBLING_WINDOW = {
	mobile: 2,
	desktop: 4,
};

/** 从扁平标题列表按 level 还原为父子树，并记录每个节点的父节点 id */
export function buildTree(items: TocItem[]): {
	tree: TocNode[];
	parentMap: Map<string, string>;
	nodeMap: Map<string, TocNode>;
} {
	const tree: TocNode[] = [];
	const parentMap = new Map<string, string>();
	const nodeMap = new Map<string, TocNode>();
	const stack: TocNode[] = [];

	for (const item of items) {
		const node: TocNode = { ...item, children: [] };
		nodeMap.set(node.id, node);

		while (stack.length > 0 && stack[stack.length - 1].level >= item.level) {
			stack.pop();
		}

		if (stack.length === 0) {
			tree.push(node);
		} else {
			const parent = stack[stack.length - 1];
			parent.children.push(node);
			parentMap.set(node.id, parent.id);
		}

		stack.push(node);
	}

	return { tree, parentMap, nodeMap };
}

/** 构建每个节点在原始 items 中的顺序索引，用于已读指示 */
export function buildFlatIndexMap(items: TocItem[]): Map<string, number> {
	const map = new Map<string, number>();
	for (let i = 0; i < items.length; i++) {
		map.set(items[i].id, i);
	}
	return map;
}

export interface TruncationInfo {
	head?: string;
	tail?: string;
}

export interface VisibilityResult {
	/** 当前需要渲染的节点 id 集合 */
	visibleIds: Set<string>;
	/** 需要显示截断锚点的父节点：key 为父节点 id 或 'root' */
	truncation: Map<string | "root", TruncationInfo>;
}

/**
 * computeVisibility - 计算 Focus TOC 下需要渲染的节点集合与截断锚点
 *
 * 非 Focus 模式返回全部可见、无截断；Focus 模式返回上下文窗口。
 */
export function computeVisibility(
	tree: TocNode[],
	parentMap: Map<string, string>,
	nodeMap: Map<string, TocNode>,
	activeId: string | null,
	focusMode: boolean,
	isMobile: boolean,
): VisibilityResult {
	const visibleIds = new Set<string>();
	const truncation = new Map<string | "root", TruncationInfo>();

	if (!focusMode || !activeId) {
		const collectAll = (nodes: TocNode[]) => {
			for (const node of nodes) {
				visibleIds.add(node.id);
				collectAll(node.children);
			}
		};
		collectAll(tree);
		return { visibleIds, truncation };
	}

	const windowSize = isMobile ? SIBLING_WINDOW.mobile : SIBLING_WINDOW.desktop;

	// 父级链 + 当前项
	let cursor = activeId;
	visibleIds.add(cursor);
	while (parentMap.has(cursor)) {
		const pid = parentMap.get(cursor);
		if (!pid) break;
		visibleIds.add(pid);
		cursor = pid;
	}

	// 当前项的兄弟项
	const activeParentId = parentMap.get(activeId);
	const siblings = activeParentId ? (nodeMap.get(activeParentId)?.children ?? []) : tree;
	const activeIndex = siblings.findIndex((n) => n.id === activeId);

	if (activeIndex >= 0) {
		const start = Math.max(0, activeIndex - windowSize);
		const end = Math.min(siblings.length, activeIndex + windowSize + 1);

		for (let i = start; i < end; i++) {
			visibleIds.add(siblings[i].id);
		}

		const info: TruncationInfo = {};
		if (start > 0) info.head = siblings[0].id;
		if (end < siblings.length) info.tail = siblings[siblings.length - 1].id;
		if (info.head || info.tail) {
			truncation.set(activeParentId ?? "root", info);
		}
	}

	// 当前项的直接子项
	const activeNode = nodeMap.get(activeId);
	if (activeNode) {
		for (const child of activeNode.children) {
			visibleIds.add(child.id);
		}
	}

	return { visibleIds, truncation };
}

/** 检测当前是否处于移动端视口 */
function useIsMobile() {
	const [isMobile, setIsMobile] = useState(false);

	useEffect(() => {
		const mq = window.matchMedia("(max-width: 639px)");
		const update = () => setIsMobile(mq.matches);
		update();
		mq.addEventListener("change", update);
		return () => mq.removeEventListener("change", update);
	}, []);

	return isMobile;
}

/** 平滑滚动元素到目标位置 */
function smoothScroll(element: HTMLElement, target: number, duration: number) {
	const start = element.scrollTop;
	const maxScroll = element.scrollHeight - element.clientHeight;
	const clampedTarget = Math.max(0, Math.min(target, maxScroll));

	if (Math.abs(start - clampedTarget) < 2 || maxScroll <= 0) return;

	const distance = clampedTarget - start;
	const startTime = performance.now();

	const step = (currentTime: number) => {
		const elapsed = currentTime - startTime;
		const progress = Math.min(elapsed / duration, 1);
		const ease = 1 - (1 - progress) ** 3;
		element.scrollTop = start + distance * ease;
		if (progress < 1) requestAnimationFrame(step);
	};

	requestAnimationFrame(step);
}

/**
 * ArticleToc - 详情页动态目录，支持 Focus TOC 模式
 *
 * spec：
 * - 有子级的节点显示 chevron，点击可展开/折叠
 * - 叶子节点显示圆点
 * - 点击标题平滑滚动到对应 heading
 * - 当前高亮项的父级路径自动展开
 * - 与阅读进度同步高亮当前 heading
 * - 长目录下进入 Focus 模式，只渲染当前项上下文窗口
 */
const ArticleToc = ({
	items,
	contentRef,
	onNavigate,
	hideTitle,
	forceFocus = false,
}: ArticleTocProps) => {
	const active = useActiveHeading(contentRef);
	const { tree, parentMap, nodeMap } = useMemo(() => buildTree(items), [items]);
	const flatIndexMap = useMemo(() => buildFlatIndexMap(items), [items]);
	const isMobile = useIsMobile();

	const [focusMode, setFocusMode] = useState(false);
	const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
	const [manualActive, setManualActive] = useState<string | null>(null);

	const displayedActive = manualActive ?? active;
	const effectiveFocusMode = forceFocus || focusMode;

	const { visibleIds, truncation } = useMemo(
		() =>
			computeVisibility(
				tree,
				parentMap,
				nodeMap,
				displayedActive,
				effectiveFocusMode,
				isMobile,
			),
		[tree, parentMap, nodeMap, displayedActive, effectiveFocusMode, isMobile],
	);

	const toggle = useCallback((id: string) => {
		setCollapsed((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	}, []);

	const handleClick = useCallback(
		(id: string) => {
			setManualActive(id);
			const el = document.getElementById(id);
			if (el) {
				el.scrollIntoView({ behavior: "smooth", block: "start" });
			}
			onNavigate?.();
		},
		[onNavigate],
	);

	/** 用户主动滚动时恢复 IntersectionObserver 驱动的高亮 */
	useEffect(() => {
		const clear = () => setManualActive(null);
		window.addEventListener("wheel", clear, { passive: true });
		window.addEventListener("touchstart", clear, { passive: true });
		return () => {
			window.removeEventListener("wheel", clear);
			window.removeEventListener("touchstart", clear);
		};
	}, []);

	/** 第一次主动滚动后进入 Focus 模式 */
	useEffect(() => {
		if (focusMode) return;

		const enterFocus = () => setFocusMode(true);
		window.addEventListener("wheel", enterFocus, { passive: true });
		window.addEventListener("touchmove", enterFocus, { passive: true });
		return () => {
			window.removeEventListener("wheel", enterFocus);
			window.removeEventListener("touchmove", enterFocus);
		};
	}, [focusMode]);

	/** 高亮项变化时自动展开其所有父级 */
	useEffect(() => {
		if (!displayedActive) return;
		setCollapsed((prev) => {
			const next = new Set(prev);
			let id = displayedActive;
			while (parentMap.has(id)) {
				const pid = parentMap.get(id);
				if (!pid) break;
				next.delete(pid);
				id = pid;
			}
			return next;
		});
	}, [displayedActive, parentMap]);

	const viewportRef = useRef<HTMLDivElement>(null);
	const activeItemRef = useRef<HTMLLIElement>(null);

	/** Focus 模式下将当前项滚动到目录可视区中央偏上 */
	useLayoutEffect(() => {
		if (!effectiveFocusMode || !displayedActive) return;

		const viewport = viewportRef.current;
		const activeEl = activeItemRef.current;
		if (!viewport || !activeEl) return;

		const viewportRect = viewport.getBoundingClientRect();
		const activeRect = activeEl.getBoundingClientRect();
		const relativeTop = activeRect.top - viewportRect.top + viewport.scrollTop;
		const target = relativeTop - viewportRect.height * 0.4;

		smoothScroll(viewport, target, 300);
	}, [effectiveFocusMode, displayedActive]);

	if (!items.length) return null;

	const activeIndex = displayedActive ? (flatIndexMap.get(displayedActive) ?? -1) : -1;
	const rootTruncation = truncation.get("root");

	return (
		<nav aria-label="目录" className="flex h-full flex-col">
			{hideTitle ? null : (
				<p className="mb-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
					目录
				</p>
			)}
			<ScrollArea ref={viewportRef} className="flex-1">
				<ul className="space-y-0.5">
					{rootTruncation?.head ? (
						<TruncationAnchor
							targetId={rootTruncation.head}
							onNavigate={handleClick}
							cfg={LEVEL_CONFIG[2]}
						/>
					) : null}
					{tree.map((node) => (
						<TreeNode
							key={node.id}
							node={node}
							active={displayedActive}
							collapsed={collapsed}
							visibleIds={visibleIds}
							truncation={truncation}
							flatIndexMap={flatIndexMap}
							activeIndex={activeIndex}
							isActiveItemRef={activeItemRef}
							onToggle={toggle}
							onNavigate={handleClick}
						/>
					))}
					{rootTruncation?.tail ? (
						<TruncationAnchor
							targetId={rootTruncation.tail}
							onNavigate={handleClick}
							cfg={LEVEL_CONFIG[2]}
						/>
					) : null}
				</ul>
			</ScrollArea>
		</nav>
	);
};

interface TreeNodeProps {
	node: TocNode;
	active: string | null;
	collapsed: Set<string>;
	visibleIds: Set<string>;
	truncation: Map<string | "root", TruncationInfo>;
	flatIndexMap: Map<string, number>;
	activeIndex: number;
	isActiveItemRef: React.RefObject<HTMLLIElement | null>;
	onToggle: (id: string) => void;
	onNavigate: (id: string) => void;
}

function TreeNode({
	node,
	active,
	collapsed,
	visibleIds,
	truncation,
	flatIndexMap,
	activeIndex,
	isActiveItemRef,
	onToggle,
	onNavigate,
}: TreeNodeProps) {
	if (!visibleIds.has(node.id)) return null;

	const isActive = active === node.id;
	const isCollapsed = collapsed.has(node.id);
	const cfg = LEVEL_CONFIG[node.level];
	const hasChildren = node.children.length > 0;
	const nodeIndex = flatIndexMap.get(node.id) ?? -1;
	const isRead = activeIndex >= 0 && nodeIndex >= 0 && nodeIndex < activeIndex;
	const nodeTruncation = truncation.get(node.id);

	return (
		<li ref={isActive ? isActiveItemRef : undefined}>
			<div
				className={
					"group relative flex w-full items-center gap-1.5 rounded-md py-1.5 pr-2 transition-colors " +
					`${cfg.indent} ${cfg.text} ` +
					(isActive
						? "bg-accent/60 font-medium text-foreground"
						: "text-muted-foreground hover:bg-accent/40 hover:text-foreground")
				}
			>
				{isActive ? (
					<span
						aria-hidden
						className="absolute top-1/2 left-0 h-5 w-0.5 -translate-y-1/2 rounded-full bg-neon-blue"
					/>
				) : null}

				{hasChildren ? (
					<button
						type="button"
						onClick={() => onToggle(node.id)}
						aria-label={isCollapsed ? "展开" : "折叠"}
						aria-expanded={!isCollapsed}
						className="flex size-4 shrink-0 items-center justify-center rounded-sm hover:bg-accent"
					>
						<ChevronRight
							aria-hidden
							className={
								"size-3 shrink-0 transition-transform " +
								(node.level === 3 ? "opacity-60 " : "") +
								(isActive
									? "text-neon-blue"
									: "text-muted-foreground/60 group-hover:text-muted-foreground") +
								(isCollapsed ? "" : " rotate-90")
							}
						/>
					</button>
				) : (
					<span aria-hidden className="flex size-4 shrink-0 items-center justify-center">
						<span
							className={
								"size-1.5 rounded-full transition-colors " +
								(isActive
									? "bg-neon-blue"
									: isRead
										? "bg-primary/70"
										: "bg-muted-foreground/40 group-hover:bg-muted-foreground/70")
							}
						/>
					</span>
				)}

				<button
					type="button"
					onClick={() => onNavigate(node.id)}
					className="flex-1 truncate text-left"
				>
					{node.text}
				</button>
			</div>

			{hasChildren && !isCollapsed ? (
				<ul className="space-y-0.5">
					{nodeTruncation?.head ? (
						<TruncationAnchor
							targetId={nodeTruncation.head}
							onNavigate={onNavigate}
							cfg={LEVEL_CONFIG[Math.min(node.level + 1, 4) as 2 | 3 | 4]}
						/>
					) : null}
					{node.children.map((child) => (
						<TreeNode
							key={child.id}
							node={child}
							active={active}
							collapsed={collapsed}
							visibleIds={visibleIds}
							truncation={truncation}
							flatIndexMap={flatIndexMap}
							activeIndex={activeIndex}
							isActiveItemRef={isActiveItemRef}
							onToggle={onToggle}
							onNavigate={onNavigate}
						/>
					))}
					{nodeTruncation?.tail ? (
						<TruncationAnchor
							targetId={nodeTruncation.tail}
							onNavigate={onNavigate}
							cfg={LEVEL_CONFIG[Math.min(node.level + 1, 4) as 2 | 3 | 4]}
						/>
					) : null}
				</ul>
			) : null}
		</li>
	);
}

interface TruncationAnchorProps {
	targetId: string;
	onNavigate: (id: string) => void;
	cfg: { indent: string; text: string };
}

function TruncationAnchor({ targetId, onNavigate, cfg }: TruncationAnchorProps) {
	return (
		<li>
			<button
				type="button"
				onClick={() => onNavigate(targetId)}
				className={
					"group flex w-full items-center gap-1.5 rounded-md py-1.5 pr-2 text-muted-foreground/60 transition-colors hover:bg-accent/40 hover:text-muted-foreground " +
					`${cfg.indent} ${cfg.text}`
				}
			>
				<span className="flex size-4 shrink-0 items-center justify-center">
					<MoreHorizontal className="size-3" />
				</span>
				<span className="flex-1 truncate text-left">更多</span>
			</button>
		</li>
	);
}

export default ArticleToc;

import { SegmentedArticleToc, type SegmentedTocNode } from "@entities/post/ui/SegmentedArticleToc";
import { type TocItem, useActiveHeading } from "@shared/hooks/use-toc";
import { ScrollArea } from "@shared/ui/scroll-area";
import { useCallback, useEffect, useMemo, useState } from "react";

export interface ArticleTocProps {
	items: TocItem[];
	/** 文章内容容器 ref，用于监听滚动与查找 heading */
	contentRef: React.RefObject<HTMLElement | null>;
	/** 点击某条目后的回调，移动端用于关闭 Sheet */
	onNavigate?: () => void;
	/** 隐藏内部 Contents 标题，外层已提供标题时使用 */
	hideTitle?: boolean;
	/** 移动端兼容参数；新版目录始终完整渲染，不做 Focus 截断 */
	forceFocus?: boolean;
}

export interface TocNode extends TocItem {
	children: TocNode[];
}

/** 从扁平标题列表按 level 还原为父子树。 */
export function buildTree(items: TocItem[]): TocNode[] {
	const roots: TocNode[] = [];
	const stack: TocNode[] = [];
	for (const item of items) {
		const node: TocNode = { ...item, children: [] };
		while (stack.length && stack[stack.length - 1].level >= node.level) stack.pop();
		const parent = stack[stack.length - 1];
		if (parent) parent.children.push(node);
		else roots.push(node);
		stack.push(node);
	}
	return roots;
}

function toSegmentedNode(node: TocNode): SegmentedTocNode {
	return {
		id: node.id,
		title: node.text,
		children: node.children.map(toSegmentedNode),
	};
}

/** 文章详情目录适配器；渲染与实验室共用同一个分段手风琴模块。 */
const ArticleToc = ({ items, contentRef, onNavigate, hideTitle }: ArticleTocProps) => {
	const observedActiveId = useActiveHeading(contentRef);
	const nodes = useMemo(() => buildTree(items).map(toSegmentedNode), [items]);
	const [manualActiveId, setManualActiveId] = useState<string | null>(null);
	const activeId = manualActiveId ?? observedActiveId ?? nodes[0]?.id ?? null;

	const handleNavigate = useCallback(
		(id: string) => {
			setManualActiveId(id);
			document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
			onNavigate?.();
		},
		[onNavigate],
	);

	useEffect(() => {
		const clearManualActive = () => setManualActiveId(null);
		window.addEventListener("wheel", clearManualActive, { passive: true });
		window.addEventListener("touchstart", clearManualActive, { passive: true });
		return () => {
			window.removeEventListener("wheel", clearManualActive);
			window.removeEventListener("touchstart", clearManualActive);
		};
	}, []);

	if (!items.length) return null;

	return (
		<nav aria-label="目录" className="flex h-full flex-col">
			{hideTitle ? null : (
				<p className="mb-3 font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
					目录
				</p>
			)}
			<ScrollArea className="flex-1">
				<SegmentedArticleToc
					nodes={nodes}
					activeId={activeId}
					onNavigate={handleNavigate}
				/>
			</ScrollArea>
		</nav>
	);
};

export default ArticleToc;

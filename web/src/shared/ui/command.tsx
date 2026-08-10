import { Dialog, DialogContent } from "@shared/ui/base/dialog";
import Empty from "@shared/ui/empty";
import { ShimmerSkeleton } from "@shared/ui/shimmer-skeleton";
import * as React from "react";

export interface CommandListProps {
	open: boolean;
	onOpenChange: (v: boolean) => void;
	items: Array<{
		id: string;
		label: string;
		group: string;
		run: () => void;
		/** 副标题（如搜索 snippet），可选 */
		description?: string;
	}>;
	query: string;
	onQueryChange: (v: string) => void;
	/** 分组显示名映射（key=group 值，value=显示文案）；缺省回退 group 原值 */
	groupLabels?: Record<string, string>;
	/** 是否加载中（空结果时显示搜索结果骨架屏） */
	loading?: boolean;
}

/**
 * CommandList - 基于 Radix Dialog 的毛玻璃命令面板内核
 *
 * 毛玻璃（backdrop-blur）+ 半透明卡，items 分组渲染。
 * 上/下键导航由父组件状态控制（此处简化为列表 + 点击执行）。
 */
function CommandList({
	open,
	onOpenChange,
	items,
	query,
	onQueryChange,
	groupLabels,
	loading = false,
}: CommandListProps) {
	const groups = React.useMemo(() => {
		const m = new Map<string, typeof items>();
		for (const it of items) {
			const arr = m.get(it.group) ?? [];
			arr.push(it);
			m.set(it.group, arr);
		}
		return Array.from(m.entries());
	}, [items]);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				showCloseButton={false}
				className="overflow-hidden border-edge-hairline bg-card p-0 dark:bg-surface-glass/70 dark:backdrop-blur-2xl"
			>
				<input
					autoFocus
					value={query}
					onChange={(e) => onQueryChange(e.target.value)}
					placeholder="搜索文章或页面…"
					className="w-full border-b border-edge-hairline bg-transparent px-4 py-3 font-mono text-sm placeholder:text-muted-foreground focus:outline-none"
				/>
				<div className="max-h-80 overflow-y-auto p-2">
					{loading && items.length === 0 ? (
						<div className="mb-2">
							<ShimmerSkeleton className="mx-3 mb-1 h-2.5 w-12" />
							{Array.from({ length: 3 }).map((_, i) => (
								<div key={i} className="px-3 py-2">
									<ShimmerSkeleton className="h-4 w-2/3" />
									<ShimmerSkeleton className="mt-1.5 h-3 w-1/2" />
								</div>
							))}
						</div>
					) : items.length === 0 ? (
						<Empty
							title="NO RESULTS"
							description="没有匹配的文章或命令"
							size="sm"
							className="py-6"
						/>
					) : (
						groups.map(([group, list]) => (
							<div key={group} className="mb-2">
								<p className="px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
									{groupLabels?.[group] ?? group}
								</p>
								{list.map((it) => (
									<button
										type="button"
										key={it.id}
										onClick={() => {
											it.run();
											onOpenChange(false);
										}}
										className="block w-full rounded-md px-3 py-2 text-left hover:bg-accent hover:text-accent-foreground"
									>
										<span className="block truncate text-sm">{it.label}</span>
										{it.description ? (
											<span className="mt-0.5 block truncate text-xs text-muted-foreground">
												{it.description}
											</span>
										) : null}
									</button>
								))}
							</div>
						))
					)}
				</div>
			</DialogContent>
		</Dialog>
	);
}

export { CommandList };

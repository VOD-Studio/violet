import { TreeNav, type TreeNavGroup } from "@shared/ui/tree-nav";
import { cn } from "cn";
import { useMemo } from "react";
import { DESIGN_SYSTEM_NAV_GROUPS } from "../model/navigation";

export interface DesignSystemSidebarProps {
	/** 当前路由路径 */
	currentPath: string;
	/** 导航点击后的回调 */
	onNavigate?: () => void;
	/** 自定义类名 */
	className?: string;
}

/**
 * 营造法式卷目索引导航：
 * 委托至 shared/ui/tree-nav 通用多级树形导航，
 * 支持最多 4 级目录深度与多级左侧竖线流体注入生长动效，严格零布局抖动。
 */
export function DesignSystemSidebar({
	currentPath,
	onNavigate,
	className,
}: DesignSystemSidebarProps) {
	const treeNavGroups: TreeNavGroup[] = useMemo(
		() =>
			DESIGN_SYSTEM_NAV_GROUPS.map((group) => ({
				id: group.id,
				title: group.title,
				items: group.items.map((item) => ({
					id: item.id,
					title: item.title,
					to: item.to,
					badge: item.num,
					children: item.children?.map((sub) => ({
						id: sub.id,
						title: sub.title,
						to: sub.to,
					})),
				})),
			})),
		[],
	);

	return (
		<div
			className={cn(
				"w-60 shrink-0 border-r border-border/50 py-2 pr-6 select-none",
				className,
			)}
		>
			{/* 卷首标题 */}
			<div className="mb-7 px-2">
				<div className="flex items-baseline gap-2">
					<span className="font-serif text-lg font-bold tracking-widest text-foreground">
						营造法式
					</span>
					<span className="font-serif text-xs font-medium text-primary/80">卷目</span>
				</div>
				<p className="mt-1 text-xs text-muted-foreground leading-relaxed">
					站点的用色、用料与营造章程
				</p>
			</div>

			{/* 多级目录导航 */}
			<TreeNav
				currentPath={currentPath}
				groups={treeNavGroups}
				onNavigate={onNavigate}
				fluidLayoutId="ds-fluid-indicator"
				ariaLabel="营造法式卷目"
			/>
		</div>
	);
}

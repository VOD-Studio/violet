import { cn } from "@shared/lib/utils";
import { Card, CardContent } from "@shared/ui/base/card";
import { Link } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import { ArrowRight, CheckCircle2 } from "lucide-react";

interface ActionTileProps {
	/** 卡片标题（如「待审评论」） */
	title: string;
	/** 待处理数量；>0 触发高亮与直达入口 */
	count: number;
	/** 标题旁图标 */
	icon: LucideIcon;
	/** count=0 时的安心文案（如「队列已清空」） */
	emptyLabel: string;
	/** count>0 时的直达入口文案（如「去审核」） */
	actionLabel: string;
	/** 直达目标路由 */
	to: string;
}

/**
 * 待办行动卡：概览页的强引导元素。
 *
 * count > 0 时 amber 高亮 + 直达入口；= 0 时绿勾安心态。
 * 待审评论 / 待审友链 / 订阅异常三张卡同构，由本组件统一承载。
 */
export function ActionTile({
	title,
	count,
	icon: Icon,
	emptyLabel,
	actionLabel,
	to,
}: ActionTileProps) {
	const hasTodo = count > 0;
	return (
		<Card className="border-border/60 h-full">
			<CardContent className="flex h-full flex-col gap-2 p-6">
				<div className="flex items-center justify-between">
					<span className="text-muted-foreground text-sm font-medium">{title}</span>
					{hasTodo ? (
						<Icon className="size-4 text-amber-500" />
					) : (
						<CheckCircle2 className="size-4 text-emerald-500" />
					)}
				</div>
				{hasTodo ? (
					<>
						<div className="text-3xl font-bold tabular-nums text-amber-600 dark:text-amber-400">
							{count}
						</div>
						<Link
							to={to}
							className={cn(
								"mt-auto inline-flex items-center gap-1 text-xs font-medium",
								"text-amber-600 hover:underline dark:text-amber-400",
							)}
						>
							{actionLabel}
							<ArrowRight className="size-3" />
						</Link>
					</>
				) : (
					<div className="text-muted-foreground mt-auto text-sm">{emptyLabel}</div>
				)}
			</CardContent>
		</Card>
	);
}

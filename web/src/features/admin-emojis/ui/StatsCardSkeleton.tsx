import { Card, CardContent, CardHeader } from "@shared/ui/card";

/**
 * StatsCardSkeleton - 统计卡片骨架屏
 *
 * 加载态占位，布局与 StatsCard 对齐。
 */
export function StatsCardSkeleton() {
	return (
		<Card>
			<CardHeader className="flex flex-row items-center justify-between pb-2">
				<div className="h-4 w-20 rounded bg-muted" />
				<div className="size-5 rounded bg-muted" />
			</CardHeader>
			<CardContent>
				<div className="h-8 w-16 rounded bg-muted" />
			</CardContent>
		</Card>
	);
}

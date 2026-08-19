import { Card, CardContent } from "@shared/ui/base/card";
import { Flag } from "lucide-react";
import { formatCompact, nextMilestone } from "../lib/metrics";

/**
 * 浏览里程碑卡。
 *
 * 累计浏览 → 下一整数刻度（1k/5k/10k/…）的进度，把冷数字变成站长成长锚点。
 */
export function MilestoneTile({ totalViews }: { totalViews: number }) {
	const { target, remaining, progress } = nextMilestone(totalViews);
	const percent = Math.min(100, Math.round(progress * 100));
	return (
		<Card className="border-border/60">
			<CardContent className="flex h-full flex-col p-5">
				<div className="flex items-center justify-between">
					<span className="text-muted-foreground text-sm font-medium">浏览里程碑</span>
					<Flag className="text-muted-foreground size-4" />
				</div>
				<div className="mt-4 flex items-baseline gap-2">
					<span className="text-3xl font-bold tabular-nums">
						{totalViews.toLocaleString("zh-CN")}
					</span>
					<span className="text-muted-foreground text-xs">累计浏览</span>
				</div>
				<div className="mt-auto pt-4">
					<div className="mb-2 flex items-center justify-between text-xs">
						<span className="text-muted-foreground">
							距 {formatCompact(target)} 还差{" "}
							<span className="text-foreground font-medium tabular-nums">
								{remaining.toLocaleString("zh-CN")}
							</span>
						</span>
						<span className="text-muted-foreground tabular-nums">{percent}%</span>
					</div>
					<div className="bg-secondary h-2 overflow-hidden rounded-full">
						<div
							className="h-full rounded-full bg-linear-to-r from-primary to-chart-2 transition-[width] duration-700"
							style={{ width: `${percent}%` }}
						/>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}

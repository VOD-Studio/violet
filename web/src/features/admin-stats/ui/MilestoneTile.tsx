import { formatCompact, nextMilestone } from "../lib/metrics";
import { TermPane } from "./TermPane";

/**
 * 浏览里程碑窗格。
 *
 * 累计浏览 → 下一整数刻度（1k/5k/10k/…）的进度，把冷数字变成站长成长锚点。
 */
export function MilestoneTile({ totalViews }: { totalViews: number }) {
	const { target, remaining, progress } = nextMilestone(totalViews);
	const percent = Math.min(100, Math.round(progress * 100));
	return (
		<TermPane
			tag="~/milestone"
			title="浏览里程碑"
			className="h-full"
			trailing={
				<span className="text-muted-foreground font-mono text-xs tabular-nums">
					{percent}%
				</span>
			}
		>
			<div className="flex h-full flex-col pt-1">
				<div className="flex items-baseline gap-2">
					<span className="text-4xl leading-none font-bold tabular-nums">
						{totalViews.toLocaleString("zh-CN")}
					</span>
					<span className="text-muted-foreground text-xs">累计浏览</span>
				</div>
				<div className="mt-auto pt-6">
					<div className="text-muted-foreground mb-2 text-xs">
						距 {formatCompact(target)} 还差{" "}
						<span className="text-foreground font-medium tabular-nums">
							{remaining.toLocaleString("zh-CN")}
						</span>
					</div>
					<div className="bg-secondary h-2 overflow-hidden rounded-full">
						<div
							className="from-chart-1 to-chart-2 h-full rounded-full bg-linear-to-r transition-[width] duration-700"
							style={{ width: `${percent}%` }}
						/>
					</div>
				</div>
			</div>
		</TermPane>
	);
}

import { useMemo } from "react";

/** 计算距离周末（周六）天数 */
function getDaysToWeekend(now = new Date()): number {
	const day = now.getDay();
	if (day === 0) return 6; // 周日
	if (day === 6) return 0; // 周六
	return 6 - day;
}

/** 计算距离月底剩余天数 */
function getDaysToEndOfMonth(now = new Date()): number {
	const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
	return lastDay - now.getDate();
}

/** 计算距离年底（12月31日）剩余天数 */
function getDaysToEndOfYear(now = new Date()): number {
	const endOfYear = new Date(now.getFullYear(), 11, 31);
	const diffTime = endOfYear.getTime() - now.getTime();
	return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
}

/**
 * 站长档案卡片时光倒计时列表
 *
 * 计算并展示距周末、距月底、距年底的剩余天数。
 */
export function HeaderTimeCountdowns() {
	const now = useMemo(() => new Date(), []);
	const daysToWeekend = getDaysToWeekend(now);
	const daysToEndOfMonth = getDaysToEndOfMonth(now);
	const daysToEndOfYear = getDaysToEndOfYear(now);

	return (
		<div className="space-y-2.5 font-mono">
			<div className="flex items-center justify-between">
				<span className="text-xs text-muted-foreground">距周末</span>
				<span className="text-sm font-bold text-foreground tabular-nums">
					{daysToWeekend}天
				</span>
			</div>
			<div className="flex items-center justify-between">
				<span className="text-xs text-muted-foreground">距月底</span>
				<span className="text-sm font-bold text-foreground tabular-nums">
					{daysToEndOfMonth}天
				</span>
			</div>
			<div className="flex items-center justify-between">
				<span className="text-xs text-muted-foreground">距年底</span>
				<span className="text-sm font-bold text-foreground tabular-nums">
					{daysToEndOfYear}天
				</span>
			</div>
		</div>
	);
}

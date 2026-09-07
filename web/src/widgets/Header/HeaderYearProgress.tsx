import { useMemo } from "react";

/** 计算本年度已过进度百分比 */
function getYearProgress(now = new Date()): number {
	const startOfYear = new Date(now.getFullYear(), 0, 1);
	const endOfYear = new Date(now.getFullYear(), 11, 31);
	const total = endOfYear.getTime() - startOfYear.getTime();
	const current = now.getTime() - startOfYear.getTime();
	return Math.min(100, Math.max(0, Math.round((current / total) * 100)));
}

/**
 * 站长档案卡片年度历程进度条
 *
 * 专职计算并渲染当年度已过进度百分比。
 */
export function HeaderYearProgress() {
	const now = useMemo(() => new Date(), []);
	const yearProgress = getYearProgress(now);

	return (
		<div className="mt-4 space-y-3 border-t border-border/40 pt-3">
			<div>
				<div className="mb-1 flex items-center justify-between font-mono text-xs">
					<span className="text-muted-foreground">{now.getFullYear()}年进程</span>
					<span className="font-semibold text-foreground tabular-nums">
						{yearProgress}%
					</span>
				</div>
				<div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/70">
					<div
						className="h-full rounded-full bg-primary transition-all duration-300"
						style={{ width: `${yearProgress}%` }}
					/>
				</div>
			</div>
		</div>
	);
}

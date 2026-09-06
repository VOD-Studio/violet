import {
	CONTRIBUTION_LEVEL_CLASS,
	getContributionLevel,
} from "@features/github/model/contribution-level";
import { cn } from "@shared/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@shared/ui/base/tooltip";
import { useMemo } from "react";

interface HeaderContributionHeatmapProps {
	githubUsername?: string;
	contributions?: Array<{ date: string; count: number }>;
	totalContributions?: number;
}

/** 热力图滚动窗口周数（约近 3 个月） */
const WEEKS_SHOWN = 13;
/** 每周天数（周日为列首，与 GitHub 贡献图一致） */
const DAYS_PER_WEEK = 7;

const pad2 = (n: number) => String(n).padStart(2, "0");
const toDateKey = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

interface DayCell {
	key: string;
	count: number;
}

/**
 * 站长开源档案近 3 个月日粒度贡献热力图
 *
 * 复刻原版信息架构：用户名与总贡献数头标、少至多图例、日历方阵与月份刻度行。
 */
export function HeaderContributionHeatmap({
	githubUsername,
	contributions,
	totalContributions = 0,
}: HeaderContributionHeatmapProps) {
	const now = useMemo(() => new Date(), []);

	// 近 13 周 × 7 天的日粒度热力矩阵：窗口右端对齐今天（最后一格即今天，无未来空位）
	const { weeks, monthTicks, todayKey } = useMemo(() => {
		const countMap = new Map<string, number>();
		for (const c of contributions ?? []) {
			countMap.set(c.date, c.count);
		}

		// 起点 = 今天向前回推 13×7-1 天，逐日填充，末格恰好落在今天
		const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
		start.setDate(start.getDate() - (WEEKS_SHOWN * DAYS_PER_WEEK - 1));

		const cols: DayCell[][] = [];
		const ticks: (string | null)[] = [];
		const today = toDateKey(now);
		for (let w = 0; w < WEEKS_SHOWN; w++) {
			const col: DayCell[] = [];
			for (let d = 0; d < DAYS_PER_WEEK; d++) {
				const day = new Date(start);
				day.setDate(day.getDate() + w * DAYS_PER_WEEK + d);
				const key = toDateKey(day);
				col.push({ key, count: countMap.get(key) ?? 0 });
			}
			cols.push(col);
			// 该列若包含某月 1 日，则在该列下方标注月份（对齐原版贡献图刻度行）
			const firstDay = col.at(0);
			const lastDay = col.at(-1);
			const crossesMonth =
				firstDay && lastDay && firstDay.key.slice(0, 7) !== lastDay.key.slice(0, 7);
			ticks.push(crossesMonth ? `${Number(lastDay.key.slice(5, 7))}月` : null);
		}
		return { weeks: cols, monthTicks: ticks, todayKey: today };
	}, [contributions, now]);

	// 热力等级与配色复用原版贡献图固定阈值分档
	const getLevelClass = (count: number) => CONTRIBUTION_LEVEL_CLASS[getContributionLevel(count)];

	// 日期格式化：「9月6日 · 5 次贡献」
	const formatDayTooltip = (key: string, count: number) => {
		const [, m, d] = key.split("-");
		return `${Number(m)}月${Number(d)}日 · ${count} 次贡献`;
	};

	return (
		<div>
			{/* 头标：用户名与年度总贡献 + 少→多图例 */}
			<div className="mb-2 flex items-end justify-between gap-3">
				<div className="min-w-0">
					{githubUsername ? (
						<p className="truncate font-mono text-[11px] text-muted-foreground">
							@{githubUsername}
						</p>
					) : null}
					<p className="text-xl font-bold tracking-tight text-foreground">
						{totalContributions.toLocaleString()}
						<span className="ml-1 text-xs font-normal text-muted-foreground">
							次贡献
						</span>
					</p>
				</div>
				<div className="flex shrink-0 items-center gap-1 pb-0.5 font-mono text-[10px] text-muted-foreground/80">
					少
					<span aria-hidden="true" className="size-2 rounded-[2px] bg-muted" />
					<span aria-hidden="true" className="size-2 rounded-[2px] bg-primary/30" />
					<span aria-hidden="true" className="size-2 rounded-[2px] bg-primary/50" />
					<span aria-hidden="true" className="size-2 rounded-[2px] bg-primary/75" />
					<span aria-hidden="true" className="size-2 rounded-[2px] bg-primary" />多
				</div>
			</div>

			<TooltipProvider>
				<div className="flex gap-0.75" role="img" aria-label="近 3 个月开源贡献热力图">
					{weeks.map((week, wIndex) => (
						<div
							key={week[0]?.key ?? wIndex}
							className="flex min-w-0 flex-1 flex-col gap-0.75"
						>
							{week.map((day) => {
								const isToday = day.key === todayKey;
								return (
									<Tooltip key={day.key}>
										<TooltipTrigger asChild>
											<span
												aria-hidden="true"
												className={cn(
													"aspect-square w-full rounded-[2px] transition-colors hover:ring-1 hover:ring-ring",
													getLevelClass(day.count),
													isToday && "ring-1 ring-primary",
												)}
											/>
										</TooltipTrigger>
										<TooltipContent side="top" sideOffset={4}>
											<p className="font-mono text-[11px]">
												{formatDayTooltip(day.key, day.count)}
											</p>
										</TooltipContent>
									</Tooltip>
								);
							})}
						</div>
					))}
				</div>
			</TooltipProvider>

			{/* 月份刻度行：与热力图列严格等宽对齐 */}
			<div className="mt-1.5 flex gap-0.75" aria-hidden="true">
				{monthTicks.map((tick, i) => (
					<span
						key={i}
						className="min-w-0 flex-1 text-left font-mono text-[9px] leading-none text-muted-foreground/70"
					>
						{tick ?? ""}
					</span>
				))}
			</div>
		</div>
	);
}

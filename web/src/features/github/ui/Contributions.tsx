import { cn } from "@shared/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@shared/ui/base/tooltip";
import Empty from "@shared/ui/empty";

import { useContributions } from "../api/queries";
import type { Contribution } from "../model/types";
import ContributionsSkeleton from "./ContributionsSkeleton";

const WEEK_DAYS = 7;
const WEEKS_SHOWN = 53;
const MONTH_LABELS = [
	"1月",
	"2月",
	"3月",
	"4月",
	"5月",
	"6月",
	"7月",
	"8月",
	"9月",
	"10月",
	"11月",
	"12月",
];

/**
 * getLevel - 根据提交数返回热度等级
 *
 * 0 -> 无贡献
 * 1-2 -> 轻度
 * 3-5 -> 中度
 * 6-9 -> 较高度
 * 10+ -> 最高
 */
const getLevel = (count: number): number => {
	if (count === 0) return 0;
	if (count <= 2) return 1;
	if (count <= 5) return 2;
	if (count <= 9) return 3;
	return 4;
};

const LEVEL_CLASS: Record<number, string> = {
	0: "bg-muted",
	1: "bg-primary/30",
	2: "bg-primary/50",
	3: "bg-primary/75",
	4: "bg-primary",
};

interface ContributionCellProps {
	contribution: Contribution;
}

const ContributionCell = ({ contribution }: ContributionCellProps) => {
	const level = getLevel(contribution.count);

	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<div
					role="img"
					className={cn(
						"w-full aspect-square rounded-sm transition-colors hover:ring-1 hover:ring-ring",
						LEVEL_CLASS[level],
					)}
					aria-label={`${contribution.date}: ${contribution.count} 次贡献`}
				/>
			</TooltipTrigger>
			<TooltipContent side="top">
				<p className="font-mono text-[11px]">
					{contribution.date} · {contribution.count} 次贡献
				</p>
			</TooltipContent>
		</Tooltip>
	);
};

/**
 * addDays - 在 YYYY-MM-DD 日期字符串上增减天数
 */
const addDays = (dateStr: string, days: number): string => {
	const date = new Date(dateStr);
	date.setDate(date.getDate() + days);
	return date.toISOString().split("T")[0];
};

interface WeekColumn {
	days: Contribution[];
	label?: string;
}

interface ContributionsGridProps {
	contributions: Contribution[];
}

const ContributionsGrid = ({ contributions }: ContributionsGridProps) => {
	const firstDate = contributions[0].date;
	const lastDate = contributions[contributions.length - 1].date;

	const countMap = new Map(contributions.map((c) => [c.date, c.count]));

	// 补齐日期范围内缺失的天数
	const allDays: Contribution[] = [];
	let cursor = firstDate;
	while (cursor <= lastDate) {
		allDays.push({ date: cursor, count: countMap.get(cursor) ?? 0 });
		cursor = addDays(cursor, 1);
	}

	// 前补齐到周日
	const leadingPadding = new Date(firstDate).getDay();
	const padded: Contribution[] = Array.from({ length: leadingPadding }, (_, i) => ({
		date: addDays(firstDate, i - leadingPadding),
		count: 0,
	}));
	padded.push(...allDays);

	// 按周分组，并标记每月首周
	const weeks: WeekColumn[] = [];
	for (let i = 0; i < padded.length; i += WEEK_DAYS) {
		const weekDays = padded.slice(i, i + WEEK_DAYS);
		if (weekDays.length < WEEK_DAYS) {
			const lastWeekDate = weekDays[weekDays.length - 1].date;
			weekDays.push(
				...Array.from({ length: WEEK_DAYS - weekDays.length }, (_, j) => ({
					date: addDays(lastWeekDate, j + 1),
					count: 0,
				})),
			);
		}

		const firstDayOfWeek = new Date(weekDays[0].date);
		const isFirstWeekOfMonth = firstDayOfWeek.getDate() <= 7;
		weeks.push({
			days: weekDays,
			label: isFirstWeekOfMonth ? MONTH_LABELS[firstDayOfWeek.getMonth()] : undefined,
		});
	}

	// 只展示最近 WEEKS_SHOWN 周
	const visibleWeeks = weeks.slice(-WEEKS_SHOWN);

	return (
		<div className="w-full">
			<div className="flex gap-1 sm:gap-1.5">
				{visibleWeeks.map((week) => (
					<div key={week.days[0].date} className="flex flex-col flex-1 min-w-0 gap-1">
						{week.days.map((day) => (
							<ContributionCell key={day.date} contribution={day} />
						))}
					</div>
				))}
			</div>
			<div className="flex gap-1 sm:gap-1.5 mt-1.5">
				{visibleWeeks.map((week) => (
					<div
						key={`label-${week.days[0].date}`}
						className="flex-1 min-w-0 text-[10px] text-muted-foreground font-mono truncate"
					>
						{week.label}
					</div>
				))}
			</div>
		</div>
	);
};

const ContributionsLegend = () => (
	<div className="flex items-center gap-2 text-[11px] text-muted-foreground font-mono">
		<span>少</span>
		{[0, 1, 2, 3, 4].map((level) => (
			<div
				key={level}
				className={cn("w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-sm", LEVEL_CLASS[level])}
			/>
		))}
		<span>多</span>
	</div>
);

export interface ContributionsProps {
	className?: string;
}

/**
 * Contributions - GitHub 风格贡献图组件
 *
 * 封装内容：
 * - 数据获取：使用 useContributions
 * - 加载态：Loader 占位
 * - 错误态：Empty 提示，不阻断页面
 * - 空数据态：Empty 提示
 * - 图表：按周排列的贡献热力图，占满容器宽度，带月份刻度与 Tooltip
 * - 图例：贡献密度说明
 */
const Contributions = ({ className }: ContributionsProps) => {
	const { data, isLoading, isError, error } = useContributions();

	if (isLoading) {
		return <ContributionsSkeleton className={className} />;
	}

	if (isError) {
		return (
			<Empty
				title="CONTRIBUTIONS UNAVAILABLE"
				description={error instanceof Error ? error.message : "贡献数据加载失败"}
				className={cn("py-12", className)}
			/>
		);
	}

	// data.contributions 可能为 null/undefined（后端返回空对象或字段缺失），
	// 不能直接读 .length，用可选链防御，避免 SSR 崩溃。
	if (!data?.contributions?.length) {
		return (
			<Empty
				title="NO CONTRIBUTIONS"
				description="暂无贡献数据"
				className={cn("py-12", className)}
			/>
		);
	}

	return (
		<TooltipProvider>
			<div className={cn("flex flex-col gap-4", className)}>
				<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
					<div className="flex flex-col gap-1">
						<p className="text-sm text-muted-foreground font-mono">@{data.username}</p>
						<p className="text-2xl font-bold tracking-tight">
							{data.total_contributions.toLocaleString()}{" "}
							<span className="text-sm font-normal text-muted-foreground">
								次贡献
							</span>
						</p>
					</div>
					<ContributionsLegend />
				</div>

				<ContributionsGrid contributions={data.contributions} />
			</div>
		</TooltipProvider>
	);
};

export default Contributions;

import { cn } from "@shared/lib/utils";
import { Card, CardContent } from "@shared/ui/base/card";
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "@shared/ui/base/chart";
import { format } from "date-fns";
import { useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { useViewTrends } from "../api/queries";

/** 档位定义：日聚合两档（后端 days 白名单）+ 月聚合一档（固定 12 个月） */
const RANGES = [
	{ key: "7d", label: "近 7 天", days: 7 },
	{ key: "30d", label: "近 30 天", days: 30 },
	{ key: "12m", label: "近 12 月", days: null },
] as const;

type RangeKey = (typeof RANGES)[number]["key"];

const chartConfig = {
	views: { label: "浏览量", color: "var(--chart-1)" },
} satisfies ChartConfig;

/**
 * 浏览趋势卡。
 *
 * 三档切换：7/30 天切 daily 序列，12 月切 monthly 序列；
 * 7/30 档共享 useViewTrends 的 days 缓存键。
 */
export function ViewTrendTile() {
	const [range, setRange] = useState<RangeKey>("30d");
	const active = RANGES.find((r) => r.key === range) ?? RANGES[1];
	// 30 档常驻（默认档 + 12 月档的 monthly 数据源）；7 档仅激活时拉取
	const daily30 = useViewTrends(30);
	const daily7 = useViewTrends(7, active.days === 7);
	const isLoading = active.days === 7 ? daily7.isLoading : daily30.isLoading;

	const points = useMemo(() => {
		if (active.days === 7) return daily7.data?.daily ?? [];
		if (active.days === 30) return daily30.data?.daily ?? [];
		return daily30.data?.monthly ?? [];
	}, [active, daily7.data, daily30.data]);

	const isEmpty = !isLoading && points.length === 0;

	return (
		<Card className="border-border/60">
			<CardContent className="flex h-full flex-col gap-4 p-6">
				<div className="flex items-center justify-between">
					<span className="text-sm font-medium">浏览趋势</span>
					<div className="bg-secondary text-muted-foreground inline-flex rounded-lg p-0.5 text-xs">
						{RANGES.map((r) => (
							<button
								key={r.key}
								type="button"
								onClick={() => setRange(r.key)}
								className={cn(
									"rounded-md px-2.5 py-1 transition-colors",
									range === r.key && "bg-background text-foreground shadow-sm",
								)}
							>
								{r.label}
							</button>
						))}
					</div>
				</div>

				{isEmpty ? (
					<div className="text-muted-foreground flex flex-1 items-center justify-center text-sm">
						还没有浏览数据
					</div>
				) : (
					<ChartContainer config={chartConfig} className="h-56 w-full">
						<AreaChart data={points} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
							<defs>
								<linearGradient id="viewTrendFill" x1="0" y1="0" x2="0" y2="1">
									<stop
										offset="0%"
										stopColor="var(--color-chart-1)"
										stopOpacity={0.28}
									/>
									<stop
										offset="100%"
										stopColor="var(--color-chart-1)"
										stopOpacity={0.02}
									/>
								</linearGradient>
							</defs>
							<CartesianGrid vertical={false} strokeDasharray="3 3" />
							<XAxis
								dataKey="label"
								tickLine={false}
								axisLine={false}
								tickMargin={8}
								minTickGap={28}
								// 日档取月日出头，月档取年月
								tickFormatter={(v: string) => (v.length > 7 ? v.slice(5) : v)}
							/>
							<YAxis
								width={32}
								tickLine={false}
								axisLine={false}
								allowDecimals={false}
							/>
							<ChartTooltip
								cursor={{ stroke: "var(--border)" }}
								content={
									<ChartTooltipContent
										indicator="line"
										labelFormatter={(label) =>
											label.length > 7
												? format(new Date(`${label}T00:00:00`), "M月d日")
												: label
										}
									/>
								}
							/>
							<Area
								dataKey="count"
								type="monotone"
								stroke="var(--color-chart-1)"
								strokeWidth={2}
								fill="url(#viewTrendFill)"
							/>
						</AreaChart>
					</ChartContainer>
				)}
			</CardContent>
		</Card>
	);
}

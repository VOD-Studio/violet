import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "@shared/ui/base/chart";
import { Segmented, type SegmentedItem } from "@shared/ui/segmented";
import { format } from "date-fns";
import { useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { useViewTrends } from "../api/queries";
import { TermPane } from "./TermPane";

/** 档位定义：日聚合两档（后端 days 白名单）+ 月聚合一档（固定 12 个月） */
const RANGES = ["7d", "30d", "12m"] as const;

type RangeKey = (typeof RANGES)[number];

/** 档位 → Segmented 配置（声明于此避免每次渲染重建） */
const SEGMENTS: SegmentedItem<RangeKey>[] = [
	{ value: "7d", label: "近 7 天" },
	{ value: "30d", label: "近 30 天" },
	{ value: "12m", label: "近 12 月" },
];

const chartConfig = {
	views: { label: "浏览量", color: "var(--chart-1)" },
} satisfies ChartConfig;

/**
 * 浏览趋势卡。
 *
 * 三档切换（Segmented 滑块）：7/30 天切 daily 序列，12 月切 monthly 序列；
 * 切档保留上一档数据渲染（keepPreviousData），不闪骨架。
 */
export function ViewTrendTile() {
	const [range, setRange] = useState<RangeKey>("30d");
	// 30 档常驻（默认档 + 12 月档的 monthly 数据源）；7 档仅激活时拉取
	const daily30 = useViewTrends(30);
	const daily7 = useViewTrends(7, range === "7d");
	const active = range === "7d" ? daily7 : daily30;

	const points = useMemo(() => {
		if (range === "7d") return daily7.data?.daily ?? [];
		if (range === "30d") return daily30.data?.daily ?? [];
		return daily30.data?.monthly ?? [];
	}, [range, daily7.data, daily30.data]);

	// 后端按窗口补零（缺失自然日计 0），序列恒非空；全零才视为无数据
	const isEmpty = !active.isLoading && points.length > 0 && points.every((p) => p.count === 0);

	return (
		<TermPane
			tag="~/trend"
			title="浏览趋势"
			className="h-full"
			trailing={<Segmented value={range} onValueChange={setRange} segments={SEGMENTS} />}
		>
			<div className="flex h-full flex-col pt-1">
				{active.isLoading ? (
					<div className="h-56" aria-busy />
				) : isEmpty ? (
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
								// 日档取月日出头（08-19），月档原样（2026-08）
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
			</div>
		</TermPane>
	);
}

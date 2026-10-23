import {
	type ChartConfig,
	ChartContainer,
	ChartLegend,
	ChartLegendContent,
	ChartTooltip,
	ChartTooltipContent,
} from "@violet/ui";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import type { UsagePoint } from "../model/usage";
import { SectionCard } from "./SectionCard";

const chartConfig = {
	requests: { label: "请求数", color: "var(--chart-1)" },
	errors: { label: "错误数", color: "var(--destructive)" },
} satisfies ChartConfig;

/** 按 UTC 自然日展示全部请求及其中的错误请求。 */
export function UsageTrendChart({ points }: { points: UsagePoint[] }) {
	return (
		<SectionCard title="请求趋势" description="按 UTC 自然日统计，错误请求包含在请求总数内。">
			<ChartContainer
				config={chartConfig}
				className="h-64 w-full"
				aria-label="每日请求与错误趋势"
			>
				<AreaChart
					accessibilityLayer
					data={points}
					margin={{ left: 0, right: 8, top: 4, bottom: 0 }}
				>
					<CartesianGrid vertical={false} strokeDasharray="3 3" />
					<XAxis
						dataKey="timestamp"
						tickLine={false}
						axisLine={false}
						tickMargin={8}
						minTickGap={28}
						tickFormatter={(value: string) => value.slice(5, 10)}
					/>
					<YAxis width={40} tickLine={false} axisLine={false} allowDecimals={false} />
					<ChartTooltip
						content={
							<ChartTooltipContent
								labelFormatter={(label) => `${String(label).slice(0, 10)} UTC`}
							/>
						}
					/>
					<ChartLegend content={<ChartLegendContent />} />
					<Area
						dataKey="requests"
						type="linear"
						stroke="var(--color-requests)"
						fill="var(--color-requests)"
						fillOpacity={0.12}
						strokeWidth={2}
						isAnimationActive={false}
					/>
					<Area
						dataKey="errors"
						type="linear"
						stroke="var(--color-errors)"
						fill="var(--color-errors)"
						fillOpacity={0.08}
						strokeWidth={2}
						isAnimationActive={false}
					/>
				</AreaChart>
			</ChartContainer>
		</SectionCard>
	);
}

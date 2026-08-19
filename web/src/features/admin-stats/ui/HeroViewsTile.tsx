import { Card, CardContent } from "@shared/ui/base/card";
import { Eye, TrendingDown, TrendingUp } from "lucide-react";
import { computeDelta } from "../lib/metrics";
import type { ViewPointDTO } from "../model/types";

interface HeroViewsTileProps {
	/** 今日浏览量 */
	today: number;
	/** 昨日浏览量（环比基数） */
	yesterday: number;
	/** 近 7 日数据点（取自 30 天趋势缓存的尾部） */
	daily: ViewPointDTO[];
}

/**
 * 今日浏览 Hero 卡。
 *
 * 72px 级大数字 + 7 日 sparkline + 昨日环比；今日与昨日均为 0 时显示「等待第一位读者」。
 */
export function HeroViewsTile({ today, yesterday, daily }: HeroViewsTileProps) {
	const delta = computeDelta(today, yesterday);
	const spark = daily.slice(-7);
	const idle = today === 0 && yesterday === 0 && spark.every((p) => p.count === 0);

	return (
		<Card className="border-border/60 h-full">
			<CardContent className="flex h-full flex-col gap-3 p-6">
				<div className="flex items-center justify-between">
					<span className="text-muted-foreground text-sm font-medium">今日浏览</span>
					<Eye className="text-muted-foreground size-4" />
				</div>

				{idle ? (
					<div className="flex flex-1 flex-col items-start justify-center gap-1">
						<span className="text-muted-foreground text-2xl font-semibold">
							等待第一位读者
						</span>
						<span className="text-muted-foreground/70 text-xs">
							文章被访问后，这里会出现第一颗数据点
						</span>
					</div>
				) : (
					<>
						<div className="flex flex-1 items-end gap-4">
							<span className="text-6xl leading-none font-bold tabular-nums">
								{today}
							</span>
							{delta && (
								<span
									className={`mb-1 flex items-center gap-1 text-sm ${
										delta.direction === "down"
											? "text-red-500"
											: delta.direction === "up"
												? "text-emerald-500"
												: "text-muted-foreground"
									}`}
								>
									{delta.direction === "up" ? (
										<TrendingUp className="size-4" />
									) : delta.direction === "down" ? (
										<TrendingDown className="size-4" />
									) : null}
									{delta.direction === "flat"
										? "与昨日持平"
										: `${delta.percent}%`}
								</span>
							)}
							{!delta && (
								<span className="text-muted-foreground/70 mb-1 text-xs">
									昨日无浏览，无环比
								</span>
							)}
						</div>
						{spark.length > 1 && (
							<div className="h-12 w-full" aria-hidden>
								<Sparkline data={spark} />
							</div>
						)}
					</>
				)}
			</CardContent>
		</Card>
	);
}

/** Sparkline - 无轴微缩趋势线，纯装饰（外层 aria-hidden） */
function Sparkline({ data }: { data: ViewPointDTO[] }) {
	const max = Math.max(...data.map((p) => p.count), 1);
	// 直接算 polyline 点位，避免为一条装饰线引入 recharts 坐标系开销
	const points = data
		.map((p, i) => {
			const x = (i / (data.length - 1)) * 100;
			const y = 30 - (p.count / max) * 26;
			return `${x},${y}`;
		})
		.join(" ");
	return (
		<svg
			viewBox="0 0 100 32"
			className="h-12 w-full"
			preserveAspectRatio="none"
			role="presentation"
		>
			<polyline
				points={points}
				fill="none"
				stroke="var(--color-chart-1)"
				strokeWidth={2}
				strokeLinecap="round"
				strokeLinejoin="round"
				vectorEffect="non-scaling-stroke"
			/>
		</svg>
	);
}

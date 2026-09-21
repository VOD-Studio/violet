import { CHART_TOKENS, NEON_TOKENS } from "@features/lab/palette/model/tokens";
import { ColorSwatch } from "@features/lab/palette/ui/ColorSwatch";
import { cn } from "@shared/lib/utils";
import { useState } from "react";

export interface ChartAndNeonSectionProps {
	mode: "light" | "dark" | "dual";
	resolvedTheme?: "light" | "dark";
	className?: string;
}

/**
 * ChartAndNeonSection - 协调图表 5 色光谱与霓虹发光材质展台。
 */
export function ChartAndNeonSection({ mode, resolvedTheme, className }: ChartAndNeonSectionProps) {
	const activeMode = mode === "dual" ? (resolvedTheme ?? "light") : mode;
	const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

	// 模拟图表比例数据
	const chartData = [
		{ label: "创作专栏", share: 38, token: CHART_TOKENS[0] },
		{ label: "工程笔记", share: 26, token: CHART_TOKENS[1] },
		{ label: "随想推文", share: 18, token: CHART_TOKENS[2] },
		{ label: "摄影图集", share: 11, token: CHART_TOKENS[3] },
		{ label: "其他灵感", share: 7, token: CHART_TOKENS[4] },
	];

	return (
		<section className={cn("mb-16", className)}>
			{/* 第一分栏：协调图表光谱 */}
			<div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-edge-hairline pb-4">
				<div>
					<p className="font-mono text-[11px] tracking-[0.3em] text-muted-foreground uppercase">
						Data Visualization Spectrum
					</p>
					<h3 className="mt-1 text-2xl font-bold tracking-tight">
						协调图表调色板（5 色）
					</h3>
				</div>
				<p className="max-w-md text-xs text-muted-foreground">
					以 Hue 286
					紫罗兰为主轴，向青蓝（220°）、翠绿（155°）、琥珀（75°）与暮霞（350°）等角分布，确保多维数据并存时不冲突。
				</p>
			</div>

			{/* 交互式图表可视化体验框 */}
			<div className="mb-10 rounded-2xl border border-edge-hairline bg-card p-6 md:p-8">
				<div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-[1fr_1.2fr]">
					{/* 左侧：微型 SVG 环形图 */}
					<div className="flex flex-col items-center justify-center">
						<div className="relative size-48">
							<svg
								className="size-full -rotate-90"
								viewBox="0 0 100 100"
								role="img"
								aria-label="内容分布环形图"
							>
								<title>内容分布环形图</title>
								{(() => {
									let accumulated = 0;
									const circumference = 2 * Math.PI * 38;
									return chartData.map((item, idx) => {
										const strokeDash = (item.share / 100) * circumference;
										const strokeOffset = -(accumulated / 100) * circumference;
										accumulated += item.share;
										const rawColor =
											activeMode === "light"
												? item.token.light
												: item.token.dark;
										const isHovered = hoveredIdx === idx;

										return (
											<circle
												key={item.label}
												cx="50"
												cy="50"
												r="38"
												fill="none"
												stroke={rawColor}
												strokeWidth={isHovered ? "14" : "10"}
												strokeDasharray={`${strokeDash} ${circumference - strokeDash}`}
												strokeDashoffset={strokeOffset}
												className="cursor-pointer transition-all duration-200"
												onMouseEnter={() => setHoveredIdx(idx)}
												onMouseLeave={() => setHoveredIdx(null)}
												onClick={() =>
													setHoveredIdx(hoveredIdx === idx ? null : idx)
												}
											/>
										);
									});
								})()}
							</svg>

							{/* 环心文字 */}
							<div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
								<span className="font-mono text-2xl font-bold">
									{hoveredIdx !== null
										? `${chartData[hoveredIdx].share}%`
										: "100%"}
								</span>
								<span className="text-[11px] text-muted-foreground">
									{hoveredIdx !== null ? chartData[hoveredIdx].label : "内容分布"}
								</span>
							</div>
						</div>
					</div>

					{/* 右侧：图表条带列表与占比 */}
					<div className="space-y-3">
						{chartData.map((item, idx) => {
							const rawColor =
								activeMode === "light" ? item.token.light : item.token.dark;
							const isHovered = hoveredIdx === idx;

							return (
								<button
									type="button"
									key={item.label}
									onMouseEnter={() => setHoveredIdx(idx)}
									onMouseLeave={() => setHoveredIdx(null)}
									onClick={() => setHoveredIdx(hoveredIdx === idx ? null : idx)}
									className={cn(
										"flex w-full cursor-pointer items-center justify-between rounded-lg border border-edge-hairline/60 p-3 text-left transition-colors",
										isHovered
											? "bg-muted/60 border-brand/40"
											: "hover:bg-muted/30",
									)}
								>
									<div className="flex items-center gap-3">
										<span
											className="size-3 rounded-full shrink-0 shadow-xs"
											style={{ backgroundColor: rawColor }}
										/>
										<div>
											<p className="text-xs font-semibold">{item.label}</p>
											<p className="font-mono text-[10px] text-muted-foreground">
												{item.token.variable}
											</p>
										</div>
									</div>
									<div className="flex items-center gap-4">
										<div className="hidden h-2 w-28 overflow-hidden rounded-full bg-muted sm:block">
											<div
												className="h-full rounded-full transition-all"
												style={{
													width: `${item.share}%`,
													backgroundColor: rawColor,
												}}
											/>
										</div>
										<span className="w-10 text-right font-mono text-xs font-bold">
											{item.share}%
										</span>
									</div>
								</button>
							);
						})}
					</div>
				</div>
			</div>

			{/* 图表令牌卡片 */}
			{mode === "dual" ? (
				<div className="mb-14 space-y-6">
					<div>
						<h4 className="mb-3 font-mono text-xs font-semibold tracking-wider text-muted-foreground uppercase">
							浅色图表光谱（5 色）
						</h4>
						<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
							{CHART_TOKENS.map((token) => (
								<ColorSwatch
									key={`light-${token.variable}`}
									token={token}
									mode="light"
								/>
							))}
						</div>
					</div>

					<div>
						<h4 className="mb-3 font-mono text-xs font-semibold tracking-wider text-muted-foreground uppercase">
							深色图表光谱（5 色）
						</h4>
						<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
							{CHART_TOKENS.map((token) => (
								<ColorSwatch
									key={`dark-${token.variable}`}
									token={token}
									mode="dark"
								/>
							))}
						</div>
					</div>
				</div>
			) : (
				<div className="mb-14 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
					{CHART_TOKENS.map((token) => (
						<ColorSwatch key={token.variable} token={token} mode={mode} />
					))}
				</div>
			)}

			{/* 第二分栏：高能霓虹发光色板 */}
			<div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-edge-hairline pb-4">
				<div>
					<p className="font-mono text-[11px] tracking-[0.3em] text-muted-foreground uppercase">
						Luminous Emission
					</p>
					<h3 className="mt-1 text-2xl font-bold tracking-tight">
						霓虹高发光调色板（Neon）
					</h3>
				</div>
				<p className="max-w-md text-xs text-muted-foreground">
					专为高科技感指示线、心跳活动徽标与暗色微光打造的高饱和度发光阶。
				</p>
			</div>

			{/* 霓虹发光光棒 */}
			{mode === "dual" ? (
				<div className="space-y-6">
					<div>
						<h4 className="mb-3 font-mono text-xs font-semibold tracking-wider text-muted-foreground uppercase">
							浅色霓虹高对比（白瓷基底）
						</h4>
						<div className="grid grid-cols-1 gap-4 sm:grid-cols-5">
							{NEON_TOKENS.map((token) => (
								<div
									key={`light-${token.variable}`}
									className="group relative flex flex-col items-center justify-between rounded-xl border border-edge-hairline bg-card p-4 transition-colors hover:border-brand/40"
								>
									<div
										className="mb-3 h-20 w-full rounded-lg shadow-sm transition-all group-hover:shadow-md"
										style={{
											backgroundColor: token.light,
											boxShadow: `0 0 16px color-mix(in oklch, ${token.light} 35%, transparent)`,
										}}
									/>
									<div className="w-full text-center">
										<span className="text-xs font-semibold">{token.name}</span>
										<span className="block font-mono text-[10px] text-muted-foreground">
											{token.variable}
										</span>
									</div>
								</div>
							))}
						</div>
					</div>

					<div>
						<h4 className="mb-3 font-mono text-xs font-semibold tracking-wider text-muted-foreground uppercase">
							深色霓虹高发光（玄曜星空基底）
						</h4>
						<div className="grid grid-cols-1 gap-4 sm:grid-cols-5">
							{NEON_TOKENS.map((token) => (
								<div
									key={`dark-${token.variable}`}
									className="group relative flex flex-col items-center justify-between rounded-xl border border-edge-hairline bg-card p-4 transition-colors hover:border-brand/40"
								>
									<div
										className="mb-3 h-20 w-full rounded-lg shadow-sm transition-all group-hover:shadow-md"
										style={{
											backgroundColor: token.dark,
											boxShadow: `0 0 16px color-mix(in oklch, ${token.dark} 45%, transparent)`,
										}}
									/>
									<div className="w-full text-center">
										<span className="text-xs font-semibold">{token.name}</span>
										<span className="block font-mono text-[10px] text-muted-foreground">
											{token.variable}
										</span>
									</div>
								</div>
							))}
						</div>
					</div>
				</div>
			) : (
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-5">
					{NEON_TOKENS.map((token) => {
						const rawColor = activeMode === "light" ? token.light : token.dark;
						return (
							<div
								key={token.variable}
								className="group relative flex flex-col items-center justify-between rounded-xl border border-edge-hairline bg-card p-4 transition-colors hover:border-brand/40"
							>
								{/* 发光光柱 */}
								<div
									className="mb-3 h-20 w-full rounded-lg shadow-sm transition-all group-hover:shadow-md"
									style={{
										backgroundColor: rawColor,
										boxShadow: `0 0 16px color-mix(in oklch, ${rawColor} 35%, transparent)`,
									}}
								/>
								<div className="w-full text-center">
									<span className="text-xs font-semibold">{token.name}</span>
									<span className="block font-mono text-[10px] text-muted-foreground">
										{token.variable}
									</span>
								</div>
							</div>
						);
					})}
				</div>
			)}
		</section>
	);
}

import { SURFACE_LAYERS } from "@features/lab/palette/model/tokens";
import { ColorSwatch } from "@features/lab/palette/ui/ColorSwatch";
import { cn } from "cn";
import { Layers } from "lucide-react";

export interface SurfaceLayersSectionProps {
	mode: "light" | "dark" | "dual";
	className?: string;
}

/**
 * SurfaceLayersSection - 明暗双重画布与 5 层空间表面体系展示。
 */
export function SurfaceLayersSection({ mode, className }: SurfaceLayersSectionProps) {
	return (
		<section className={cn("mb-16", className)}>
			<div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-edge-hairline pb-4">
				<div>
					<p className="font-mono text-[11px] tracking-[0.3em] text-muted-foreground uppercase">
						Surfaces & Spatial Stack
					</p>
					<h3 className="mt-1 text-2xl font-bold tracking-tight">
						明暗双重画布与空间表面体系
					</h3>
				</div>
				<p className="max-w-md text-xs text-muted-foreground">
					双域底色杜绝纯黑（#000）的死寂与纯白（#FFF）的刺目眩光，以白瓷与玄曜为基底，自下而上建立
					5 层轻量空间进深。
				</p>
			</div>

			{/* 空间堆叠图示：层级可视化卡片 */}
			<div className="mb-10 grid grid-cols-1 gap-6 lg:grid-cols-2">
				{/* 浅色空间堆叠模型 */}
				{(mode === "light" || mode === "dual") && (
					<div className="rounded-2xl border border-black/10 bg-[#faf9fd] p-6 text-[#13111c] shadow-xs">
						<div className="mb-4 flex items-center justify-between">
							<span className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
								<Layers className="size-3.5 text-brand" />
								浅色画布空间层叠 · 温润白瓷
							</span>
							<span className="font-mono text-[10px] text-slate-400">
								oklch(0.992 0.003 286)
							</span>
						</div>

						{/* 堆叠层级演示 */}
						<div className="space-y-2.5">
							{/* Level 0 底色 */}
							<div className="rounded-xl border border-slate-200/80 bg-white/50 p-3.5 text-xs text-slate-600">
								<div className="flex items-center justify-between font-mono text-[11px]">
									<span className="font-semibold text-slate-800">
										L0 · 总画布 Canvas
									</span>
									<span>--background</span>
								</div>
								<p className="mt-1 text-[11px] text-slate-500">
									微泛极浅冷香白瓷，反射率 99.2%，温润无刺激。
								</p>
							</div>

							{/* Level 1 卡片 */}
							<div className="ml-3 rounded-xl border border-slate-200/90 bg-white p-3.5 text-xs shadow-xs">
								<div className="flex items-center justify-between font-mono text-[11px]">
									<span className="font-semibold text-slate-900">
										L1 · 卡片面板 Card
									</span>
									<span>--card</span>
								</div>
								<p className="mt-1 text-[11px] text-slate-600">
									纯白实体表面，从白瓷底色自然浮起，承载主要内容。
								</p>
							</div>

							{/* Level 2 浮层与薄雾 */}
							<div
								className="ml-6 rounded-xl border p-3.5 text-xs shadow-xs"
								style={{
									backgroundColor: "oklch(0.965 0.022 286)",
									color: "oklch(0.35 0.14 286)",
									borderColor: "oklch(0.53 0.205 286 / 20%)",
								}}
							>
								<div className="flex items-center justify-between font-mono text-[11px]">
									<span className="font-semibold">L2 · 薄雾受光面 Wash</span>
									<span>--brand-wash</span>
								</div>
								<p className="mt-1 text-[11px] opacity-80">
									交互高亮与弱强调徽章，仅保留 2.2% 极轻彩度。
								</p>
							</div>

							{/* 古籍纸面 */}
							<div
								className="rounded-xl border p-3.5 text-xs shadow-xs"
								style={{
									backgroundColor: "oklch(0.976 0.012 85)",
									color: "oklch(0.24 0.014 60)",
									borderColor: "oklch(0.885 0.018 80)",
								}}
							>
								<div className="flex items-center justify-between font-mono text-[11px]">
									<span className="font-semibold">专栏 · 暖米古籍纸 Paper</span>
									<span>--paper</span>
								</div>
								<p className="mt-1 text-[11px] opacity-80">
									暖色系古纸阅读底，为专栏与文档提供典雅的书卷气质。
								</p>
							</div>
						</div>
					</div>
				)}

				{/* 深色空间堆叠模型 */}
				{(mode === "dark" || mode === "dual") && (
					<div className="dark rounded-2xl border border-white/10 bg-[#0d0b14] p-6 text-[#f5f4fa] shadow-xs">
						<div className="mb-4 flex items-center justify-between">
							<span className="flex items-center gap-1.5 text-xs font-semibold text-zinc-300">
								<Layers className="size-3.5 text-brand" />
								深色画布空间层叠 · 玄曜星空
							</span>
							<span className="font-mono text-[10px] text-zinc-500">
								oklch(0.138 0.012 286)
							</span>
						</div>

						{/* 堆叠层级演示 */}
						<div className="space-y-2.5">
							{/* Level 0 底色 */}
							<div className="rounded-xl border border-white/8 bg-black/40 p-3.5 text-xs text-zinc-400">
								<div className="flex items-center justify-between font-mono text-[11px]">
									<span className="font-semibold text-zinc-200">
										L0 · 总画布 Canvas
									</span>
									<span>--background</span>
								</div>
								<p className="mt-1 text-[11px] text-zinc-500">
									低彩度黑曜石底色，明度 13.8%，如夜空沉静无声。
								</p>
							</div>

							{/* Level 1 卡片 */}
							<div
								className="ml-3 rounded-xl border border-white/10 p-3.5 text-xs shadow-xs"
								style={{ backgroundColor: "oklch(0.185 0.015 286)" }}
							>
								<div className="flex items-center justify-between font-mono text-[11px]">
									<span className="font-semibold text-zinc-100">
										L1 · 卡片面板 Card
									</span>
									<span>--card</span>
								</div>
								<p className="mt-1 text-[11px] text-zinc-400">
									提升至 18.5% 明度的黑曜面板，界定内容容器。
								</p>
							</div>

							{/* Level 2 浮层与薄雾 */}
							<div
								className="ml-6 rounded-xl border p-3.5 text-xs shadow-xs"
								style={{
									backgroundColor: "oklch(0.22 0.038 286)",
									color: "oklch(0.9 0.07 286)",
									borderColor: "oklch(0.72 0.148 286 / 25%)",
								}}
							>
								<div className="flex items-center justify-between font-mono text-[11px]">
									<span className="font-semibold">L2 · 薄雾受光面 Wash</span>
									<span>--brand-wash</span>
								</div>
								<p className="mt-1 text-[11px] opacity-80">
									半透明暗紫微光，丁香紫前景色，透光不刺目。
								</p>
							</div>

							{/* 古籍纸面 */}
							<div
								className="rounded-xl border p-3.5 text-xs shadow-xs"
								style={{
									backgroundColor: "oklch(0.23 0.012 70)",
									color: "oklch(0.92 0.012 80)",
									borderColor: "oklch(0.32 0.012 70)",
								}}
							>
								<div className="flex items-center justify-between font-mono text-[11px]">
									<span className="font-semibold">专栏 · 深褐古纸 Paper</span>
									<span>--paper</span>
								</div>
								<p className="mt-1 text-[11px] opacity-80">
									深褐泛古阅读面搭配浅象牙墨，护眼舒适。
								</p>
							</div>
						</div>
					</div>
				)}
			</div>

			{/* 表面令牌卡片网格 */}
			{mode === "dual" ? (
				<div className="space-y-8">
					<div>
						<h4 className="mb-3 font-mono text-xs font-semibold tracking-wider text-muted-foreground uppercase">
							浅色白瓷空间表面（6 阶材质）
						</h4>
						<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
							{SURFACE_LAYERS.map((token) => (
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
							深色玄曜空间表面（6 阶材质）
						</h4>
						<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
							{SURFACE_LAYERS.map((token) => (
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
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{SURFACE_LAYERS.map((token) => (
						<ColorSwatch key={token.variable} token={token} mode={mode} />
					))}
				</div>
			)}
		</section>
	);
}

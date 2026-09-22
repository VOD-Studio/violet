import { TONAL_RAMP, type TonalRampStep } from "@features/lab/palette/model/tokens";
import { copyText } from "@shared/lib/clipboard";
import { getContrastRatio, oklchToRgb, parseOklch } from "@shared/lib/color-math";
import { cn } from "@shared/lib/utils";
import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export interface TonalRampSectionProps {
	className?: string;
}

/**
 * TonalRampSection - 11 阶紫罗兰（Hue 286）连续光谱色阶展台。
 */
export function TonalRampSection({ className }: TonalRampSectionProps) {
	const [activeStep, setActiveStep] = useState<TonalRampStep>(TONAL_RAMP[5]); // 默认选中 500
	const [copiedKey, setCopiedKey] = useState<string | null>(null);

	const parsedActive = parseOklch(activeStep.oklch);
	const rgbActive = parsedActive
		? oklchToRgb(parsedActive.l, parsedActive.c, parsedActive.h)
		: null;

	const handleCopy = async (text: string, label: string) => {
		const ok = await copyText(text);
		if (ok) {
			setCopiedKey(label);
			toast.success(`已复制 ${label}: ${text}`);
			setTimeout(() => setCopiedKey(null), 2000);
		} else {
			toast.error(`复制 ${label} 失败，请检查剪贴板权限`);
		}
	};

	return (
		<section className={cn("mb-16", className)}>
			<div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-edge-hairline pb-4">
				<div>
					<p className="font-mono text-[11px] tracking-[0.3em] text-muted-foreground uppercase">
						Tonal Ramp · Hue 286°
					</p>
					<h3 className="mt-1 text-2xl font-bold tracking-tight">紫罗兰全域色阶光谱</h3>
				</div>
				<p className="max-w-md text-xs text-muted-foreground">
					基于 OKLCH 感知均匀空间构建的 11 档梯度，从 97.5% 明度薄雾至 13.8%
					暗夜黑曜，色相恒定 286°，无色彩偏差。
				</p>
			</div>

			{/* 连贯平滑色彩彩带 */}
			<div className="mb-8 overflow-hidden rounded-xl border border-edge-hairline p-1 shadow-xs">
				<div className="grid grid-cols-11 overflow-hidden rounded-lg">
					{TONAL_RAMP.map((step) => {
						const isSelected = activeStep.step === step.step;
						return (
							<button
								key={step.step}
								type="button"
								onClick={() => setActiveStep(step)}
								className={cn(
									"group relative flex h-16 flex-col items-center justify-between p-2 transition-all outline-none md:h-24",
									isSelected
										? "ring-2 ring-foreground ring-offset-2 ring-offset-background"
										: "",
								)}
								style={{ backgroundColor: step.oklch }}
								aria-label={`色阶 ${step.step} ${step.name}`}
							>
								<span
									className={cn(
										"font-mono text-[10px] font-semibold md:text-xs",
										step.step >= 600 ? "text-white" : "text-slate-900",
									)}
								>
									{step.step}
								</span>
								<span
									className={cn(
										"hidden font-mono text-[9px] opacity-75 md:inline-block",
										step.step >= 600 ? "text-white/80" : "text-slate-900/80",
									)}
								>
									{step.name.slice(0, 2)}
								</span>
							</button>
						);
					})}
				</div>
			</div>

			{/* 当前选中色阶详情剖析面板 */}
			<div className="grid grid-cols-1 gap-6 rounded-2xl border border-edge-hairline bg-card p-6 md:grid-cols-[1fr_1.5fr] md:p-8">
				{/* 左侧：色彩预览与对比度 */}
				<div className="flex flex-col justify-between">
					<div>
						<div className="flex items-center gap-2">
							<span className="font-mono text-2xl font-bold tracking-tight">
								Violet {activeStep.step}
							</span>
							<span className="rounded-md border border-edge-hairline bg-background/50 px-2 py-0.5 font-mono text-xs text-muted-foreground">
								{activeStep.name}
							</span>
						</div>
						<p className="mt-2 text-sm text-muted-foreground">{activeStep.usage}</p>
					</div>

					<div className="mt-6 flex flex-wrap gap-2">
						<button
							type="button"
							onClick={() => handleCopy(rgbActive?.hex.toUpperCase() ?? "", "Hex")}
							className="flex items-center gap-1.5 rounded-md border border-edge-hairline bg-background px-3 py-1.5 font-mono text-xs font-medium transition-colors hover:border-brand"
						>
							{copiedKey === "Hex" ? (
								<Check className="size-3 text-emerald-500" />
							) : (
								<Copy className="size-3" />
							)}
							<span>{rgbActive?.hex.toUpperCase()}</span>
						</button>

						<button
							type="button"
							onClick={() => handleCopy(activeStep.oklch, "OKLCH")}
							className="flex items-center gap-1.5 rounded-md border border-edge-hairline bg-background px-3 py-1.5 font-mono text-xs font-medium transition-colors hover:border-brand"
						>
							{copiedKey === "OKLCH" ? (
								<Check className="size-3 text-emerald-500" />
							) : (
								<Copy className="size-3" />
							)}
							<span>{activeStep.oklch}</span>
						</button>
					</div>
				</div>

				{/* 右侧：在不同底色上的呈现效果 */}
				<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
					{/* 浅底呈现 */}
					<div className="rounded-xl border border-edge-hairline bg-[#faf9fd] p-4 text-[#13111c]">
						<div className="flex items-center justify-between text-xs text-slate-500">
							<span>温润白瓷画布预览</span>
							<span className="font-mono">
								{getContrastRatio(activeStep.oklch, "oklch(0.992 0.003 286)")}:1
							</span>
						</div>
						<div className="mt-3 flex items-center gap-3">
							<div
								className="size-10 rounded-lg shadow-xs"
								style={{ backgroundColor: activeStep.oklch }}
							/>
							<div className="min-w-0">
								<p
									className="text-sm font-semibold"
									style={{ color: activeStep.oklch }}
								>
									示例文本预览
								</p>
								<p className="text-xs text-slate-500">紫罗兰冷香调文本</p>
							</div>
						</div>
					</div>

					{/* 深底呈现 */}
					<div className="rounded-xl border border-edge-hairline bg-[#0d0b14] p-4 text-[#f5f4fa]">
						<div className="flex items-center justify-between text-xs text-zinc-400">
							<span>玄曜星空画布预览</span>
							<span className="font-mono">
								{getContrastRatio(activeStep.oklch, "oklch(0.138 0.012 286)")}:1
							</span>
						</div>
						<div className="mt-3 flex items-center gap-3">
							<div
								className="size-10 rounded-lg shadow-xs"
								style={{ backgroundColor: activeStep.oklch }}
							/>
							<div className="min-w-0">
								<p
									className="text-sm font-semibold"
									style={{ color: activeStep.oklch }}
								>
									示例文本预览
								</p>
								<p className="text-xs text-zinc-400">星空紫水晶微光</p>
							</div>
						</div>
					</div>
				</div>
			</div>
		</section>
	);
}

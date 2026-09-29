import { copyText } from "@shared/lib/clipboard";
import { hexToOklch, oklchToRgb } from "@shared/lib/color-math";
import { AnchoredHeading } from "@shared/ui/anchored-heading";
import { HsvColorPicker } from "@violet/ui";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import type { RampStep } from "../model/palette";
import { generatePalette } from "../model/palette";
import { ColorRoleComparison } from "./ColorRoleComparison";

const VIOLET_SEED = oklchToRgb(0.53, 0.205, 286).hex;
const CORAL_SEED = oklchToRgb(0.625, 0.19, 25).hex;

/** 主色速选预设库 */
const SEED_PRESETS = [
	{ hex: VIOLET_SEED, name: "紫罗兰" },
	{ hex: CORAL_SEED, name: "暖珊瑚" },
	{ hex: "#2563eb", name: "靛蓝" },
	{ hex: "#0891b2", name: "青" },
	{ hex: "#059669", name: "松绿" },
	{ hex: "#65a30d", name: "橄榄" },
	{ hex: "#d97706", name: "暖橙" },
	{ hex: "#dc2626", name: "绯红" },
	{ hex: "#db2777", name: "玫红" },
] as const;

const DEFAULT_SEED = SEED_PRESETS[0].hex;

/**
 * 给定主色推导色阶、语义角色与对比度；正文插入位于角色预览与审计之间。
 *
 * @param children - 用色指南正文，独立于生成器计算状态
 */
export function PaletteGenerator({ children }: { children?: ReactNode }) {
	const [seedHex, setSeedHex] = useState(DEFAULT_SEED);
	const [hoverRamp, setHoverRamp] = useState<string | null>(null);
	const [copiedRamp, setCopiedRamp] = useState<string | null>(null);

	const seed = useMemo(() => hexToOklch(seedHex), [seedHex]);
	const palette = useMemo(
		() =>
			generatePalette({
				l: seed?.l ?? 0.53,
				h: seed?.h ?? 222,
				c: seed?.c ?? 0.16,
			}),
		[seed],
	);

	const pickRamp = async (step: RampStep) => {
		const hex = step.hex.toUpperCase();
		if (await copyText(hex)) {
			setCopiedRamp(step.label);
			toast.success(`已复制 色阶 ${step.label}: ${hex}`);
			setTimeout(() => setCopiedRamp(null), 1500);
		}
	};

	return (
		<div className="mt-8">
			{/* 主色控制台与色阶推导；文节内容见 content/palette.md */}
			{/* 主控制台 Deck：严格遵循布局规格 */}
			<div className="rounded-2xl border border-border/40 bg-card/50 p-6">
				<div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
					{/* 左侧：主色标本与参数 */}
					<div className="flex flex-col justify-between space-y-3">
						<div>
							<span className="block text-xs font-semibold text-muted-foreground">
								当前主色
							</span>
							<div
								className="mt-2 flex h-32 w-full flex-col justify-end rounded-xl p-4 ring-1 ring-black/5 transition-colors duration-200"
								style={{ backgroundColor: seedHex }}
							>
								<div className="flex items-baseline justify-between">
									<code
										className={`font-mono text-xl font-bold tracking-wider ${
											(seed?.l ?? 0.5) < 0.65
												? "text-white"
												: "text-slate-900"
										}`}
									>
										{seedHex.toUpperCase()}
									</code>
									<button
										className={`rounded-md px-2 py-1 text-[11px] font-medium backdrop-blur-xs transition-opacity hover:opacity-90 ${
											(seed?.l ?? 0.5) < 0.65
												? "bg-white/20 text-white"
												: "bg-black/15 text-slate-900"
										}`}
										onClick={async () => {
											if (await copyText(seedHex.toUpperCase())) {
												toast.success(
													`已复制主色: ${seedHex.toUpperCase()}`,
												);
											}
										}}
										type="button"
									>
										复制 HEX
									</button>
								</div>
							</div>
						</div>

						<div className="space-y-2">
							<div className="grid grid-cols-3 gap-2">
								<div className="rounded-lg border border-border/50 bg-background/50 p-2 text-center">
									<span className="block text-[10px] text-muted-foreground">
										明度 L
									</span>
									<span className="font-mono text-xs font-semibold tabular-nums">
										{seed ? `${(seed.l * 100).toFixed(1)}%` : "—"}
									</span>
								</div>
								<div className="rounded-lg border border-border/50 bg-background/50 p-2 text-center">
									<span className="block text-[10px] text-muted-foreground">
										彩度 C
									</span>
									<span className="font-mono text-xs font-semibold tabular-nums">
										{seed ? seed.c.toFixed(3) : "—"}
									</span>
								</div>
								<div className="rounded-lg border border-border/50 bg-background/50 p-2 text-center">
									<span className="block text-[10px] text-muted-foreground">
										色相 H
									</span>
									<span className="font-mono text-xs font-semibold tabular-nums">
										{seed ? `${seed.h.toFixed(0)}°` : "—"}
									</span>
								</div>
							</div>
							<div className="rounded-lg border border-border/40 bg-background/30 px-3 py-1.5 font-mono text-[11px] text-muted-foreground">
								{seed
									? `oklch(${seed.l.toFixed(3)} ${seed.c.toFixed(3)} ${seed.h.toFixed(1)})`
									: "—"}
							</div>
						</div>
					</div>

					{/* 右侧：调色盘 + 下方纯色速选点 */}
					<div className="flex flex-col justify-between space-y-4">
						<div>
							<span className="block text-xs font-semibold text-muted-foreground">
								自定义主色
							</span>
							<div className="mt-2">
								<HsvColorPicker onChange={setSeedHex} value={seedHex} />
							</div>
						</div>

						<div className="border-t border-border/40 pt-3">
							<span className="block text-xs font-semibold text-muted-foreground">
								主色速选
							</span>
							<div
								aria-label="主色速选"
								className="mt-2 flex flex-wrap items-center gap-2.5"
								role="group"
							>
								{SEED_PRESETS.map((preset) => {
									const isSelected =
										seedHex.toLowerCase() === preset.hex.toLowerCase();
									return (
										<button
											aria-label={`主色 ${preset.name}`}
											className={`size-7 cursor-pointer rounded-full transition-[box-shadow,filter] duration-150 ease-out hover:brightness-110 ${
												isSelected
													? ""
													: "ring-1 ring-border/60 hover:ring-border"
											}`}
											key={preset.hex}
											onClick={() => setSeedHex(preset.hex)}
											style={{
												backgroundColor: preset.hex,
												boxShadow: isSelected
													? `0 0 0 2px var(--color-card, #fff), 0 0 0 4px ${preset.hex}`
													: undefined,
											}}
											title={preset.name}
											type="button"
										/>
									);
								})}
							</div>
						</div>
					</div>
				</div>
			</div>
			{/* 主色色阶卡尺 */}
			<div className="mt-10 flex flex-wrap items-baseline justify-between gap-2">
				<AnchoredHeading
					as="h2"
					id="主色色阶"
					className="text-2xl font-bold tracking-tight"
				>
					主色色阶
				</AnchoredHeading>
				<span className="text-xs text-muted-foreground">点击任意色阶即可复制 HEX 码</span>
			</div>
			<div className="mt-3 overflow-hidden rounded-2xl border border-border/40 shadow-[0_4px_24px_rgba(0,0,0,0.05)]">
				<div className="grid grid-cols-11">
					{palette.ramp.map((step, i) => {
						const isLight = i < 5;
						const isSelected = hoverRamp === step.label || copiedRamp === step.label;
						return (
							<button
								aria-label={`色阶 ${step.label} · ${step.hex.toUpperCase()}`}
								className="group relative flex h-20 flex-col justify-between p-2 text-left outline-none transition-[filter] duration-150 ease-out hover:brightness-105"
								key={step.label}
								onClick={() => void pickRamp(step)}
								onMouseEnter={() => setHoverRamp(step.label)}
								onMouseLeave={() => setHoverRamp(null)}
								style={{ backgroundColor: step.hex }}
								title={`${step.label} · ${step.hex.toUpperCase()}`}
								type="button"
							>
								<span
									className={`pointer-events-none absolute inset-0 flex items-center justify-center font-mono text-[10px] font-semibold tracking-wide whitespace-nowrap transition-opacity duration-150 ease-out ${
										isLight ? "text-slate-900" : "text-white"
									} ${isSelected ? "opacity-100" : "opacity-0"}`}
								>
									{copiedRamp === step.label
										? "✓ 已复制"
										: step.hex.toUpperCase()}
								</span>
								<span
									className={`font-mono text-[11px] font-semibold transition-opacity duration-150 ${
										isLight ? "text-slate-800" : "text-white"
									} ${isSelected ? "opacity-20" : "opacity-75"}`}
								>
									{step.label}
								</span>
								<span
									className={`block font-mono text-[9px] tabular-nums transition-opacity duration-150 ${
										isLight ? "text-slate-700/60" : "text-white/60"
									} ${isSelected ? "opacity-0" : "opacity-100"}`}
								>
									{step.hex.toUpperCase()}
								</span>
							</button>
						);
					})}
				</div>
			</div>
			<div className="mt-2 grid grid-cols-11" aria-hidden="true">
				{palette.ramp.map((step) => (
					<span
						className={`text-center font-mono text-[10px] tabular-nums transition-colors duration-150 ease-out ${
							hoverRamp === step.label || copiedRamp === step.label
								? "font-bold text-foreground"
								: "text-muted-foreground"
						}`}
						key={step.label}
					>
						{step.label}
					</span>
				))}
			</div>

			<ColorRoleComparison palette={palette} />

			{children}

			{/* 对比度审计 */}
			<section>
				<div className="mt-10 flex items-baseline justify-between">
					<AnchoredHeading
						as="h2"
						id="对比度审计"
						className="text-2xl font-bold tracking-tight"
					>
						对比度审计
					</AnchoredHeading>
					<span className="font-mono text-xs text-muted-foreground">
						WCAG 2.1 规范验算
					</span>
				</div>
				<ul className="mt-3 divide-y divide-border/40 rounded-xl border border-border/40 bg-card/30 px-4">
					{palette.audits.map((audit) => (
						<li className="flex items-baseline gap-3 py-2.5 text-sm" key={audit.pair}>
							<span
								className={`inline-flex size-4 items-center justify-center rounded-full text-xs font-bold ${
									audit.pass
										? "bg-success/15 text-success"
										: "bg-destructive/15 text-destructive"
								}`}
							>
								{audit.pass ? "✓" : "✗"}
							</span>
							<span className="flex-1 text-muted-foreground">{audit.pair}</span>
							<code className="font-mono text-xs font-semibold tabular-nums">
								{audit.ratio.toFixed(2)}:1
							</code>
							<span
								className={`w-20 text-right font-mono text-xs ${
									audit.pass ? "text-muted-foreground" : "text-destructive"
								}`}
							>
								{audit.rating}
							</span>
						</li>
					))}
				</ul>
			</section>
		</div>
	);
}

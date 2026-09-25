import { BRAND_TOKENS } from "@features/lab/palette/model/tokens";
import { useThemeSwitcher } from "@features/lab/theme/ui/use-theme-switcher";
import { copyText } from "@shared/lib/clipboard";
import { getContrastRatio, oklchToRgb, parseOklch } from "@shared/lib/color-math";
import { Segmented } from "@shared/ui/segmented";
import { cn } from "cn";
import { Check, Copy, Moon, Sparkles, Sun } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export type DisplayMode = "sync" | "light" | "dark" | "dual";

export interface PaletteHeroProps {
	mode: DisplayMode;
	onModeChange: (mode: DisplayMode) => void;
	resolvedTheme: "light" | "dark";
}

/**
 * PaletteHero - 调色板实验室主视觉看板与模式切换器。
 */
export function PaletteHero({ mode, onModeChange, resolvedTheme }: PaletteHeroProps) {
	const { switchTheme } = useThemeSwitcher();
	const [copied, setCopied] = useState(false);

	// 浅色与深色品牌主色参数
	const brandToken = BRAND_TOKENS[0];
	const lightParsed = parseOklch(brandToken.light);
	const darkParsed = parseOklch(brandToken.dark);
	const lightRgb = lightParsed ? oklchToRgb(lightParsed.l, lightParsed.c, lightParsed.h) : null;
	const darkRgb = darkParsed ? oklchToRgb(darkParsed.l, darkParsed.c, darkParsed.h) : null;

	const lightContrast = getContrastRatio(brandToken.light, "oklch(0.992 0.003 286)");
	const darkContrast = getContrastRatio(brandToken.dark, "oklch(0.138 0.012 286)");

	// 单域模式下生效的属性
	const effectiveTheme = mode === "dual" ? resolvedTheme : mode === "sync" ? resolvedTheme : mode;
	const activeBrandOklch = effectiveTheme === "light" ? brandToken.light : brandToken.dark;
	const activeParsed = effectiveTheme === "light" ? lightParsed : darkParsed;
	const activeRgb = effectiveTheme === "light" ? lightRgb : darkRgb;
	const activeContrast = effectiveTheme === "light" ? lightContrast : darkContrast;

	const handleCopyAll = async () => {
		const cssVariables = `:root {
  /* 品牌紫罗兰强调（浅色：皇家鸢尾紫） */
  --brand: oklch(0.53 0.205 286);
  --brand-foreground: oklch(0.99 0 0);
  --brand-hover: oklch(0.47 0.215 286);
  --brand-wash: oklch(0.965 0.022 286);
  --brand-wash-foreground: oklch(0.35 0.14 286);
  --brand-ring: oklch(0.53 0.205 286);
}

.dark {
  /* 品牌紫罗兰强调（深色：星空紫水晶，全 sRGB 覆盖） */
  --brand: oklch(0.72 0.148 286);
  --brand-foreground: oklch(0.14 0.02 286);
  --brand-hover: oklch(0.77 0.138 286);
  --brand-wash: oklch(0.22 0.038 286);
  --brand-wash-foreground: oklch(0.9 0.07 286);
  --brand-ring: oklch(0.72 0.148 286);
}`;
		const ok = await copyText(cssVariables);
		if (ok) {
			setCopied(true);
			toast.success("已复制紫罗兰色彩系统 CSS 变量");
			setTimeout(() => setCopied(false), 2000);
		} else {
			toast.error("复制失败，请检查剪贴板权限");
		}
	};

	return (
		<section className="mb-14">
			{/* 模式选择与控制栏 */}
			<div className="mb-8 flex flex-wrap items-center justify-between gap-4">
				<div className="flex items-center gap-3">
					<Segmented
						value={mode}
						onValueChange={(val) => {
							onModeChange(val as DisplayMode);
							if (val === "light") switchTheme("light");
							if (val === "dark") switchTheme("dark");
						}}
						segments={[
							{ value: "sync", label: "跟随全站" },
							{ value: "light", label: "浅色白瓷" },
							{ value: "dark", label: "深色玄曜" },
							{ value: "dual", label: "双域并置" },
						]}
					/>
				</div>

				<button
					type="button"
					onClick={handleCopyAll}
					className="flex items-center gap-1.5 rounded-lg border border-edge-hairline bg-card px-3.5 py-2 text-xs font-medium text-foreground transition-colors hover:border-brand hover:text-brand"
				>
					{copied ? (
						<Check className="size-3.5 text-emerald-500" />
					) : (
						<Copy className="size-3.5" />
					)}
					<span>导出品牌变量</span>
				</button>
			</div>

			{/* 主视觉 Hero 色彩展示板 */}
			<div className="relative overflow-hidden rounded-2xl border border-edge-hairline bg-card p-6 md:p-10 shadow-xs">
				<div
					className={cn(
						"grid items-center gap-8",
						mode === "dual"
							? "grid-cols-1 lg:grid-cols-[1fr_1.4fr]"
							: "grid-cols-1 lg:grid-cols-[1.2fr_1fr]",
					)}
				>
					{/* 左侧：色彩叙事与哲学参数 */}
					<div>
						<div className="mb-3 flex items-center gap-2">
							<span className="inline-flex items-center gap-1 rounded-full bg-brand-wash px-2.5 py-1 text-xs font-medium text-brand-wash-foreground">
								<Sparkles className="size-3" />
								Hue 286° · 鸢尾冷香
							</span>
							<span className="rounded-full border border-edge-hairline px-2.5 py-0.5 font-mono text-[11px] text-muted-foreground">
								WCAG{" "}
								{mode === "dual"
									? `浅 ${lightContrast}:1 · 深 ${darkContrast}:1`
									: `${activeContrast >= 7.0 ? "AAA" : "AA"} ${activeContrast}:1`}
							</span>
						</div>

						<h2 className="text-3xl font-bold tracking-tight md:text-4xl">
							冷香紫罗兰签名体系
						</h2>

						<p className="mt-4 text-sm leading-relaxed text-muted-foreground md:text-base">
							全站视觉灵魂。根植于 OKLCH 色彩空间的 286°
							鸢尾蓝紫色相，浅色宛如白瓷微漾冷香，深色宛如星空紫水晶。摒弃纯黑纯白带来的视觉刺激，通过精准的彩度调校（暗色
							Chroma = 0.148），确保在全色系设备上 100% sRGB 无裁切呈现。
						</p>

						{/* 科学维度徽标 */}
						<div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
							<div className="rounded-lg border border-edge-hairline/60 bg-background/50 p-3">
								<span className="block text-[11px] text-muted-foreground">
									色相 Hue
								</span>
								<span className="mt-0.5 font-mono text-base font-semibold">
									286°
								</span>
							</div>
							<div className="rounded-lg border border-edge-hairline/60 bg-background/50 p-3">
								<span className="block text-[11px] text-muted-foreground">
									彩度 Chroma
								</span>
								<span className="mt-0.5 font-mono text-base font-semibold">
									{mode === "dual"
										? `${lightParsed?.c.toFixed(3)} / ${darkParsed?.c.toFixed(3)}`
										: (activeParsed?.c.toFixed(3) ?? "0.205")}
								</span>
							</div>
							<div className="rounded-lg border border-edge-hairline/60 bg-background/50 p-3">
								<span className="block text-[11px] text-muted-foreground">
									明度 Lightness
								</span>
								<span className="mt-0.5 font-mono text-base font-semibold">
									{mode === "dual"
										? `${lightParsed?.l.toFixed(2)} / ${darkParsed?.l.toFixed(2)}`
										: (activeParsed?.l.toFixed(2) ?? "0.53")}
								</span>
							</div>
							<div className="rounded-lg border border-edge-hairline/60 bg-background/50 p-3">
								<span className="block text-[11px] text-muted-foreground">
									Hex 代码
								</span>
								<span className="mt-0.5 font-mono text-base font-semibold">
									{mode === "dual"
										? `${lightRgb?.hex.toUpperCase()} / ${darkRgb?.hex.toUpperCase()}`
										: (activeRgb?.hex.toUpperCase() ?? "#684DDA")}
								</span>
							</div>
						</div>
					</div>

					{/* 右侧：超大透光主色块与色轮角标 */}
					<div className="flex flex-col items-center justify-center">
						{mode === "dual" ? (
							<div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2">
								{/* 浅色域主色块 */}
								<div
									className="relative flex h-60 w-full flex-col justify-between overflow-hidden rounded-2xl border border-edge-hairline/80 p-5 shadow-md"
									style={{ backgroundColor: brandToken.light }}
								>
									<div className="pointer-events-none absolute -top-12 -right-12 size-36 rounded-full bg-white/20 blur-xl" />
									<div className="relative z-10 flex items-center justify-between text-white">
										<span className="font-mono text-[11px] font-semibold tracking-wider uppercase">
											Royal Iris · 浅色
										</span>
										<div className="flex items-center gap-1 rounded-full bg-black/20 px-2 py-0.5 text-[10px] backdrop-blur-xs">
											<Sun className="size-3" />
											<span>5.7:1 AA</span>
										</div>
									</div>
									<div className="relative z-10 text-white">
										<span className="font-mono text-xl font-bold tracking-tight">
											{lightRgb?.hex.toUpperCase()}
										</span>
										<p className="mt-0.5 font-mono text-[11px] opacity-90">
											{brandToken.light}
										</p>
									</div>
								</div>

								{/* 深色域主色块 */}
								<div
									className="relative flex h-60 w-full flex-col justify-between overflow-hidden rounded-2xl border border-edge-hairline/80 p-5 shadow-md"
									style={{ backgroundColor: brandToken.dark }}
								>
									<div className="pointer-events-none absolute -top-12 -right-12 size-36 rounded-full bg-white/30 blur-xl" />
									<div className="relative z-10 flex items-center justify-between text-slate-950">
										<span className="font-mono text-[11px] font-semibold tracking-wider uppercase">
											Amethyst · 深色
										</span>
										<div className="flex items-center gap-1 rounded-full bg-black/15 px-2 py-0.5 text-[10px] backdrop-blur-xs">
											<Moon className="size-3" />
											<span>6.0:1 AA</span>
										</div>
									</div>
									<div className="relative z-10 text-slate-950">
										<span className="font-mono text-xl font-bold tracking-tight">
											{darkRgb?.hex.toUpperCase()}
										</span>
										<p className="mt-0.5 font-mono text-[11px] opacity-90">
											{brandToken.dark}
										</p>
									</div>
								</div>
							</div>
						) : (
							<div
								className="relative flex h-64 w-full flex-col justify-between overflow-hidden rounded-2xl border border-edge-hairline/80 p-6 shadow-md"
								style={{ backgroundColor: activeBrandOklch }}
							>
								{/* 背景柔和微晕 */}
								<div className="pointer-events-none absolute -top-16 -right-16 size-48 rounded-full bg-white/20 blur-2xl" />

								{/* 顶部标签 */}
								<div
									className="relative z-10 flex items-center justify-between"
									style={{
										color:
											effectiveTheme === "light"
												? "oklch(0.99 0 0)"
												: "oklch(0.14 0.02 286)",
									}}
								>
									<span className="font-mono text-xs font-semibold tracking-wider uppercase">
										Violet Iris · Brand Primary
									</span>
									<div className="flex items-center gap-1.5 rounded-full bg-black/20 px-2 py-0.5 text-[11px] backdrop-blur-xs">
										{effectiveTheme === "light" ? (
											<Sun className="size-3" />
										) : (
											<Moon className="size-3" />
										)}
										<span className="capitalize">{effectiveTheme}</span>
									</div>
								</div>

								{/* 底部代码 */}
								<div
									className="relative z-10"
									style={{
										color:
											effectiveTheme === "light"
												? "oklch(0.99 0 0)"
												: "oklch(0.14 0.02 286)",
									}}
								>
									<span className="font-mono text-2xl font-bold tracking-tight md:text-3xl">
										{activeRgb?.hex.toUpperCase()}
									</span>
									<p className="mt-1 font-mono text-xs opacity-90">
										{activeBrandOklch}
									</p>
								</div>
							</div>
						)}

						<p className="mt-3 font-mono text-xs text-muted-foreground">
							{mode === "dual"
								? "左侧白瓷底色上的皇家鸢尾 (L: 0.53) ↔ 右侧星空底色上的紫水晶 (L: 0.72)"
								: effectiveTheme === "light"
									? "浅色白瓷底色上的皇家鸢尾 (Lightness 0.53 · 对比度 5.7:1)"
									: "深色星空底色上的紫水晶 (Lightness 0.72 · 对比度 6.0:1)"}
						</p>
					</div>
				</div>
			</div>
		</section>
	);
}

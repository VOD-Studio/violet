import { copyText } from "@shared/lib/clipboard";
import { hexToOklch, oklchToRgb } from "@shared/lib/color-math";
import { CodeCard } from "@shared/ui/code-preview/components/CodeCard";
import { HsvColorPicker } from "@violet/ui";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import type { RampStep } from "../model/palette";
import { generatePalette } from "../model/palette";
import usageDemoSource from "./examples/palette/usage.tsx?raw";
import { ColorRoleComparison } from "./ColorRoleComparison";
import { GuideLink } from "./library-guides/GuideParts";

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

/** 「在 CSS 文件中」示例：语义变量的两种消费方式。 */
const USAGE_CSS_SNIPPET = `/* 直接使用 CSS 变量 */
.my-component {
	background: var(--primary-base);
	color: var(--primary-base-foreground);
	border: 1px solid var(--border);
}

/* 配合 @apply 与 @layer */
@layer components {
	.action-button {
		@apply bg-primary-base text-primary-base-foreground;

		&:hover {
			@apply bg-primary-base-hover;
		}
	}
}`;

/** 默认主色源预设源码副本；真实文件为 @violet/ui 的 styles/palettes/violet.css，改契约需两处同步。 */
const VIOLET_PALETTE_SOURCE = `/*
 * 默认主色源预设。
 *
 * 本层只提供稳定主色及其状态；页面方言决定是否把语义 primary 映射到主色源。
 * 画布与行为状态色不在 palette 管辖内。
 * 明暗成对取值以 light-dark() 单声明表达，暗色支由 html 上的 .dark
 * （color-scheme: dark）激活。
 */
:root {
	--primary-base: light-dark(oklch(0.53 0.205 286), oklch(0.72 0.148 286));
	--primary-base-foreground: light-dark(oklch(0.99 0 0), oklch(0.14 0.02 286));
	--primary-base-hover: light-dark(oklch(0.47 0.215 286), oklch(0.77 0.138 286));
	--primary-base-soft: light-dark(oklch(0.965 0.022 286), oklch(0.22 0.038 286));
	--primary-base-soft-foreground: light-dark(oklch(0.35 0.14 286), oklch(0.9 0.07 286));
	--primary-base-ring: light-dark(oklch(0.53 0.205 286), oklch(0.72 0.148 286));
}`;

/** 暖珊瑚覆盖预设源码副本；真实文件为 web/src/styles/palettes/coral.css，改契约需两处同步。 */
const CORAL_PALETTE_SOURCE = `/*
 * 暖珊瑚主色源预设。
 *
 * 与组件库默认 palette 提供相同的 primary-base 契约；页面调用方不感知预设名。
 * 明暗成对取值以 light-dark() 单声明表达，暗色支由 html 上的 .dark
 * （color-scheme: dark）激活。
 */
:root {
	--primary-base: light-dark(oklch(0.625 0.19 25), oklch(0.72 0.15 22));
	--primary-base-foreground: light-dark(oklch(0.99 0 0), oklch(0.17 0 0));
	--primary-base-hover: light-dark(oklch(0.575 0.185 25), oklch(0.67 0.155 22));
	--primary-base-soft: light-dark(oklch(0.95 0.025 25), oklch(0.25 0.025 22));
	--primary-base-soft-foreground: light-dark(oklch(0.36 0.11 25), oklch(0.88 0.065 22));
	--primary-base-ring: light-dark(oklch(0.625 0.19 25), oklch(0.72 0.15 22));
}`;

/** 站点业务语义色模式节选（真实文件 web/src/styles/site-tokens.css，此处展示「定义 + 注册」骨架）。 */
const SITE_TOKENS_SNIPPET = `/*
 * 站点业务语义色：只被本站特定场景消费的颜色。
 * 组件库基础层只保留跨场景的通用语义；本文件定义值并注册同名的
 * Tailwind 颜色工具类，导入顺序在包样式之后。
 */
:root {
	/* 纸面：明暗成对取值以 light-dark() 单声明表达 */
	--paper: light-dark(oklch(0.976 0.012 85), oklch(0.23 0.012 70));
	--paper-foreground: light-dark(oklch(0.24 0.014 60), oklch(0.92 0.012 80));
}

@theme inline {
	--color-paper: var(--paper);
	--color-paper-foreground: var(--paper-foreground);
}`;

/**
 * 色板生成器章内容：给一个主色，推导色阶与完整语义角色。
 * 自定义主色只控制本页预览容器，不写入项目主题。
 */
export function PaletteGenerator() {
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
			<p className="text-sm leading-7 text-muted-foreground">
				颜色体系围绕语义意图构建，而非堆砌色板：先选对角色，色值由主题与下面的生成器提供。
				成对使用背景与前景，文本对比度需满足 WCAG AA。
			</p>
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
										className={`font-mono text-xl font-bold tracking-wider ${(seed?.l ?? 0.5) < 0.65
												? "text-white"
												: "text-slate-900"
											}`}
									>
										{seedHex.toUpperCase()}
									</code>
									<button
										className={`rounded-md px-2 py-1 text-[11px] font-medium backdrop-blur-xs transition-opacity hover:opacity-90 ${(seed?.l ?? 0.5) < 0.65
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
											className={`size-7 cursor-pointer rounded-full transition-[box-shadow,filter] duration-150 ease-out hover:brightness-110 ${isSelected
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
				<h3 className="text-lg font-bold">主色色阶</h3>
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
									className={`pointer-events-none absolute inset-0 flex items-center justify-center font-mono text-[10px] font-semibold tracking-wide whitespace-nowrap transition-opacity duration-150 ease-out ${isLight ? "text-slate-900" : "text-white"
										} ${isSelected ? "opacity-100" : "opacity-0"}`}
								>
									{copiedRamp === step.label
										? "✓ 已复制"
										: step.hex.toUpperCase()}
								</span>
								<span
									className={`font-mono text-[11px] font-semibold transition-opacity duration-150 ${isLight ? "text-slate-800" : "text-white"
										} ${isSelected ? "opacity-20" : "opacity-75"}`}
								>
									{step.label}
								</span>
								<span
									className={`block font-mono text-[9px] tabular-nums transition-opacity duration-150 ${isLight ? "text-slate-700/60" : "text-white/60"
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
						className={`text-center font-mono text-[10px] tabular-nums transition-colors duration-150 ease-out ${hoverRamp === step.label || copiedRamp === step.label
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

			{/* 如何使用颜色 */}
			<section className="mt-10" id="palette-usage">
				<h3 className="text-lg font-bold">如何使用颜色</h3>
				<p className="mt-1 max-w-3xl text-sm leading-7 text-muted-foreground">
					组件只消费语义角色，不根据具体色相分支：solid 与 foreground、soft 与
					soft-foreground 成对使用，悬停与聚焦态由主色源派生，文字对比度需满足 WCAG AA。
				</p>
				<div className="mt-4 space-y-4">
					<CodeCard code={usageDemoSource} language="tsx" title="在组件中" />
					<CodeCard code={USAGE_CSS_SNIPPET} language="css" title="在 CSS 文件中" />
				</div>
			</section>

			{/* 默认主题 */}
			<section className="mt-10">
				<h3 className="text-lg font-bold">默认主题</h3>
				<p className="mt-1 max-w-3xl text-sm leading-7 text-muted-foreground">
					主题分三层：主色源预设提供六变量契约（base / foreground / hover / soft /
					soft-foreground / ring），每支以 light-dark() 同时声明浅色与深色取值， 暗色支由
					html 上的 .dark（color-scheme: dark）激活；语义 token
					定义画布、正文与行为状态色；
					<code className="font-mono text-[13px]">@theme inline</code> 把两者映射为
					Tailwind 工具类。换主题只替换主色源层。
				</p>
				<CodeCard
					className="mt-4"
					code={VIOLET_PALETTE_SOURCE}
					language="css"
					title="@violet/ui/styles/palettes/violet.css"
				/>
			</section>

			{/* 自定义颜色 */}
			<section className="mt-10">
				<h3 className="text-lg font-bold">自定义颜色</h3>
				<p className="mt-1 max-w-3xl text-sm leading-7 text-muted-foreground">
					覆盖主色源：新建预设文件提供同名六变量，在包样式之后导入，行为状态色不随主色更换。
					添加业务语义色：在站点层以 light-dark() 声明明暗成对取值，并在{" "}
					<code className="font-mono text-[13px]">@theme inline</code> 注册同名{" "}
					<code className="font-mono text-[13px]">--color-*</code>{" "}
					即得到对应工具类。完整约束见{" "}
					<GuideLink to="/design-system/guides/theming">主题指南</GuideLink>。
				</p>
				<div className="mt-4 space-y-4">
					<CodeCard
						code={CORAL_PALETTE_SOURCE}
						language="css"
						title="覆盖主色源 · palettes/coral.css"
					/>
					<CodeCard
						code={SITE_TOKENS_SNIPPET}
						language="css"
						title="添加业务色 · styles/site-tokens.css"
					/>
				</div>
			</section>

			{/* 对比度审计 */}
			<section>
				<div className="mt-10 flex items-baseline justify-between">
					<h3 className="text-lg font-bold">对比度审计</h3>
					<span className="font-mono text-xs text-muted-foreground">
						WCAG 2.1 规范验算
					</span>
				</div>
				<ul className="mt-3 divide-y divide-border/40 rounded-xl border border-border/40 bg-card/30 px-4">
					{palette.audits.map((audit) => (
						<li className="flex items-baseline gap-3 py-2.5 text-sm" key={audit.pair}>
							<span
								className={`inline-flex size-4 items-center justify-center rounded-full text-xs font-bold ${audit.pass
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
								className={`w-20 text-right font-mono text-xs ${audit.pass ? "text-muted-foreground" : "text-destructive"
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

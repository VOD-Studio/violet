import { copyText } from "@shared/lib/clipboard";
import { hexToOklch, oklchToRgb } from "@shared/lib/color-math";
import { CodeCard } from "@shared/ui/code-preview/components/CodeCard";
import { HsvColorPicker } from "@violet/ui";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import coralPaletteSource from "../../../../packages/ui/src/styles/palettes/coral.css?raw";
import violetPaletteSource from "../../../../packages/ui/src/styles/palettes/violet.css?raw";
import type { RampStep } from "../model/palette";
import { generatePalette } from "../model/palette";
import { ColorRoleComparison } from "./ColorRoleComparison";
import { ColorUsageDemo } from "./examples/color/usage";
import usageSource from "./examples/color/usage.tsx?raw";
import { GuideLink } from "./library-guides/GuideParts";

const VIOLET_SEED = oklchToRgb(0.53, 0.205, 286).hex;
const CORAL_SEED = oklchToRgb(0.625, 0.19, 25).hex;

const VIOLET_PALETTE_CSS = violetPaletteSource.slice(violetPaletteSource.indexOf(":root {"));
const CORAL_PALETTE_CSS = coralPaletteSource.slice(coralPaletteSource.indexOf(":root"));

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

const USAGE_CSS_SNIPPET = `/* 在应用的 CSS 文件中；先由入口导入 @violet/ui/styles.css */
.my-component {
	background: var(--primary-base);
	color: var(--primary-base-foreground);
	border: 1px solid var(--border);
}

@layer components {
	.action-button {
		@apply bg-primary-base text-primary-base-foreground;
		&:hover {
			@apply bg-primary-base-hover;
		}
	}
}`;

const OVERRIDE_ENTRY_SNIPPET = `/* src/styles.css：先加载包，再加载应用自己的覆盖文件 */
@import "tailwindcss";
@import "@violet/ui/styles.css";
@import "@violet/ui/palettes/coral.css";

/* 仅需要品牌色作为默认动作时，在自己的作用域里成对映射 */
.brand-actions {
	--primary: var(--primary-base);
	--primary-foreground: var(--primary-base-foreground);
}`;

const CUSTOM_COLOR_SNIPPET = `/* src/styles/notice.css；在应用入口的包样式之后导入 */
:root {
	--notice: light-dark(oklch(0.52 0.15 240), oklch(0.72 0.12 240));
	--notice-foreground: light-dark(oklch(0.99 0 0), oklch(0.15 0.02 240));
}

@theme inline {
	--color-notice: var(--notice);
	--color-notice-foreground: var(--notice-foreground);
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

			{/* 如何使用颜色 */}
			<section className="mt-10" id="palette-usage">
				<h3 className="text-lg font-bold">如何使用颜色</h3>
				<p className="mt-1 text-sm leading-7 text-muted-foreground">
					先选语义角色，再成对使用背景与前景色；自定义元素也一样用{" "}
					<code>bg-primary-base-soft text-primary-base-soft-foreground</code>
					，不要只换背景不换文字。
				</p>
				<div className="mt-4 space-y-5">
					<div>
						<h4 className="mb-2 text-sm font-semibold">在组件中</h4>
						<p className="mb-3 text-sm leading-7 text-muted-foreground">
							<code>Button</code> 不传 variant（即 default）使用{" "}
							<code>--primary</code>
							：裸包默认是高对比中性色；本页处于本站公开内容方言，已将它映射到 Violet
							主色，因此下方预览的默认按钮也是紫色。<code>primary</code> 始终使用{" "}
							<code>--primary-base</code>，<code>soft</code> 使用{" "}
							<code>--primary-base-soft</code> 及各自的前景色。
						</p>
						<CodeCard code={usageSource} language="tsx" title="组件与工具类">
							<ColorUsageDemo />
						</CodeCard>
					</div>
					<div>
						<h4 className="mb-2 text-sm font-semibold">在 CSS 文件中</h4>
						<p className="mb-3 text-sm leading-7 text-muted-foreground">
							应用 CSS 可直接读取 <code>var(--primary-base)</code>；使用{" "}
							<code>@apply</code> 时，把规则写在由 Tailwind v4
							编译的应用样式中，且先在入口导入 <code>tailwindcss</code> 与{" "}
							<code>@violet/ui/styles.css</code>。
						</p>
						<CodeCard code={USAGE_CSS_SNIPPET} language="css" title="应用样式示例" />
					</div>
				</div>
			</section>

			{/* 默认主题 */}
			<section className="mt-10">
				<h3 className="text-lg font-bold">默认主题</h3>
				<p className="mt-1 text-sm leading-7 text-muted-foreground">
					入口只需 <code>@import "@violet/ui/styles.css";</code>（先导入{" "}
					<code>tailwindcss</code>）。包内的 <code>tokens.css</code> 提供默认中性{" "}
					<code>--primary</code> 与画布、状态色；<code>palettes/violet.css</code> 提供六个{" "}
					<code>--primary-base*</code> 主色源值；<code>theme.css</code> 用{" "}
					<code>@theme inline</code> 注册{" "}
					<code>--color-primary-base: var(--primary-base)</code>
					，使 <code>bg-primary-base</code> 在使用位置读取当前变量。下面展示包内预设源码，
					不是可导入的包子路径。
				</p>
				<p className="mt-2 text-sm leading-7 text-muted-foreground">
					默认 <code>:root</code> 为 <code>color-scheme: light</code>；宿主把{" "}
					<code>.dark</code> 挂在 html 时，<code>color-scheme: dark</code> 激活{" "}
					<code>light-dark()</code> 的暗色值。本站 <code>.dialect-public</code> 才将{" "}
					<code>--primary</code> 与前景色映射到主色源；这个站点方言不随包发布。
				</p>
				<CodeCard
					className="mt-4"
					code={VIOLET_PALETTE_CSS}
					language="css"
					title="包内源码 · 默认 violet.css"
				/>
			</section>

			{/* 自定义颜色 */}
			<section className="mt-10">
				<h3 className="text-lg font-bold">自定义颜色</h3>
				<div className="mt-4 space-y-5">
					<div>
						<h4 className="text-sm font-semibold">覆盖已有颜色</h4>
						<p className="mt-1 text-sm leading-7 text-muted-foreground">
							在应用自己的 CSS
							中覆盖主色源六变量（基色、前景、悬停、柔和底与前景、焦点环），
							保留明暗两套值并检查文字对比度。本站的珊瑚文件是完整示例；放在包样式之后导入。
							仅需局部改变默认动作时，还须在同一作用域成对重映射{" "}
							<code>--primary</code> / <code>--primary-foreground</code>
							；不能只在子元素重写 <code>--primary-base</code>
							，期待上层方言继承的默认动作自动更新。
						</p>
						<p className="mt-2 text-sm leading-7 text-muted-foreground">
							<code>--success</code> / <code>--success-foreground</code>{" "}
							等行为状态色不会随主色源切换；
							若要改其视觉值，另外成对覆盖同名语义变量即可，已有{" "}
							<code>--color-*</code> 映射不用重复注册。
						</p>
						<CodeCard
							className="mt-3"
							code={CORAL_PALETTE_CSS}
							language="css"
							title="包内源码 · palettes/coral.css"
						/>
						<CodeCard
							className="mt-3"
							code={OVERRIDE_ENTRY_SNIPPET}
							language="css"
							title="应用入口与可选的局部语义映射"
						/>
					</div>
					<div>
						<h4 className="text-sm font-semibold">添加自定义颜色</h4>
						<p className="mt-1 text-sm leading-7 text-muted-foreground">
							新颜色要同时定义底色与前景色，并在应用 CSS 以 <code>@theme inline</code>{" "}
							注册各自的 <code>--color-*</code> 映射。把示例文件在包样式后以{" "}
							<code>@import "./styles/notice.css";</code> 导入应用入口，再使用{" "}
							<code>className="bg-notice text-notice-foreground"</code>。 现有{" "}
							<code>primary-base</code>、<code>success</code>{" "}
							等已经注册，不必重复声明。
						</p>
						<CodeCard
							className="mt-3"
							code={CUSTOM_COLOR_SNIPPET}
							language="css"
							title="应用自有颜色 · src/styles/notice.css"
						/>
					</div>
				</div>
				<p className="mt-3 text-sm text-muted-foreground">
					主题切换与站点作用域的完整设置见{" "}
					<GuideLink to="/design-system/guides/theming">主题指南</GuideLink>
					；调好主色后可用
					<GuideLink to="/design-system/guides/theme-builder">主题构建器</GuideLink>
					导出可落盘的色板 CSS。
				</p>
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

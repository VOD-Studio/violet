import { copyText } from "@shared/lib/clipboard";
import { hexToOklch, oklchToRgb } from "@shared/lib/color-math";
import { HsvColorPicker, Segmented } from "@violet/ui";
import { Check, Copy } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import type { GeneratedPalette, RampStep } from "../model/palette";
import { generatePalette } from "../model/palette";
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

/**
 * 代码导出工作台：生成标准 CSS Variables 或 Tailwind v4 @theme inline 声明代码。
 */
function PaletteCodeExport({ palette, seedHex }: { palette: GeneratedPalette; seedHex: string }) {
	const [exportFormat, setExportFormat] = useState<"css" | "tailwind">("css");
	const [copied, setCopied] = useState(false);

	const code = useMemo(() => {
		if (exportFormat === "css") {
			return `/* —— Violet 色板配置 (主色: ${seedHex.toUpperCase()}) —— */
:root {
  --primary-base: ${palette.primaryRoles[0].light.oklch};
  --primary-base-foreground: ${palette.primaryRoles[2].light.oklch};
  --primary-base-hover: ${palette.primaryRoles[1].light.oklch};
  --primary-base-soft: ${palette.primaryRoles[3].light.oklch};
  --primary-base-soft-foreground: ${palette.primaryRoles[4].light.oklch};
  --primary-base-ring: ${palette.primaryRoles[0].light.oklch};

  /* 状态功能色 */
  --destructive: ${palette.functional[3].light.oklch};
  --warning: ${palette.functional[2].light.oklch};
  --success: ${palette.functional[1].light.oklch};
  --info: ${palette.functional[0].light.oklch};
}

.dark {
  --primary-base: ${palette.primaryRoles[0].dark.oklch};
  --primary-base-foreground: ${palette.primaryRoles[2].dark.oklch};
  --primary-base-hover: ${palette.primaryRoles[1].dark.oklch};
  --primary-base-soft: ${palette.primaryRoles[3].dark.oklch};
  --primary-base-soft-foreground: ${palette.primaryRoles[4].dark.oklch};
  --primary-base-ring: ${palette.primaryRoles[0].dark.oklch};

  /* 状态功能色 */
  --destructive: ${palette.functional[3].dark.oklch};
  --warning: ${palette.functional[2].dark.oklch};
  --success: ${palette.functional[1].dark.oklch};
  --info: ${palette.functional[0].dark.oklch};
}`;
		}

		return `/* —— Tailwind CSS v4 主色色阶 —— */
@theme inline {
  --color-primary-50: ${palette.ramp[0].hex};
  --color-primary-100: ${palette.ramp[1].hex};
  --color-primary-200: ${palette.ramp[2].hex};
  --color-primary-300: ${palette.ramp[3].hex};
  --color-primary-400: ${palette.ramp[4].hex};
  --color-primary-500: ${palette.ramp[5].hex};
  --color-primary-600: ${palette.ramp[6].hex};
  --color-primary-700: ${palette.ramp[7].hex};
  --color-primary-800: ${palette.ramp[8].hex};
  --color-primary-900: ${palette.ramp[9].hex};
  --color-primary-950: ${palette.ramp[10].hex};
}`;
	}, [exportFormat, palette, seedHex]);

	const handleCopy = async () => {
		if (await copyText(code)) {
			setCopied(true);
			toast.success("已复制色板代码到剪贴板");
			setTimeout(() => setCopied(false), 1500);
		}
	};

	return (
		<section className="mt-10">
			<div className="flex flex-wrap items-baseline justify-between gap-2">
				<h3 className="text-lg font-bold">代码导出</h3>
				<div className="flex items-center gap-2">
					<Segmented<"css" | "tailwind">
						onValueChange={setExportFormat}
						segments={[
							{ value: "css", label: "CSS 变量" },
							{ value: "tailwind", label: "Tailwind v4 @theme" },
						]}
						size="sm"
						value={exportFormat}
					/>
					<button
						className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-card px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted/60"
						onClick={() => void handleCopy()}
						type="button"
					>
						{copied ? (
							<Check className="size-3.5 text-success" />
						) : (
							<Copy className="size-3.5" />
						)}
						<span>{copied ? "已复制" : "复制代码"}</span>
					</button>
				</div>
			</div>

			<div className="mt-3 overflow-hidden rounded-xl border border-border/40 bg-slate-950 p-4 text-slate-200">
				<pre className="overflow-x-auto font-mono text-xs leading-relaxed">
					<code>{code}</code>
				</pre>
			</div>
		</section>
	);
}

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

			<section className="mt-10" id="palette-usage">
				<h3 className="text-lg font-bold">组件中如何用色</h3>
				<p className="mt-1 max-w-3xl text-sm leading-7 text-muted-foreground">
					组件只消费语义角色，不根据具体色相分支。颜色负责表达动作优先级与状态，
					尺寸、字重、描边和上下文负责形成其余视觉差异。
				</p>
				<div className="mt-4 grid gap-3 sm:grid-cols-2">
					{[
						{
							title: "主色用于最高优先级",
							body: "一个操作区只保留一个实色主动作；选择、hover 与次级提示改用柔和主色。",
						},
						{
							title: "状态色不可互换",
							body: "成功、警告、危险和信息只表达对应状态，不作为装饰或栏目分类颜色。",
						},
						{
							title: "表面依赖中性色层级",
							body: "画布、卡片和弱化面由少量基础值派生，靠小幅明度差和描边组织空间。",
						},
						{
							title: "前景必须与背景成对",
							body: "solid 与 foreground、soft 与 soft-foreground 成对使用，并通过对比度审计。",
						},
					].map((principle) => (
						<article
							className="rounded-xl border border-border/50 bg-card/40 p-4"
							key={principle.title}
						>
							<h4 className="text-sm font-semibold">{principle.title}</h4>
							<p className="mt-1.5 text-xs leading-5 text-muted-foreground">
								{principle.body}
							</p>
						</article>
					))}
				</div>
			</section>

			<section className="mt-10">
				<h3 className="text-lg font-bold">默认主题与自定义颜色</h3>
				<p className="mt-1 text-sm leading-7 text-muted-foreground">
					当前选色器是本页受控预览：切换主色只更新上方浅色与深色示例，
					不会写入根节点、持久化设置或改变项目其他界面。项目真正接入主题切换时，
					在独立主题作用域覆盖主色源；完整约束见{" "}
					<GuideLink to="/design-system/guides/theming">主题</GuideLink>。
				</p>
				<pre className="mt-3 overflow-x-auto rounded-xl border border-border/40 bg-card/30 p-4 font-mono text-xs leading-6 text-foreground">
					<code>
						{
							'/* 组件只消费语义 */\n<Button variant="primary">保存</Button>\n<Button variant="soft">稍后处理</Button>\n\n/* 自定义主题作用域：当前项目尚未接入运行时切换 */\n[data-theme="custom"] {\n  --primary-base: oklch(0.62 0.18 250);\n  --primary-base-foreground: oklch(0.99 0 0);\n  --primary-base-hover: oklch(0.56 0.19 250);\n  --primary-base-soft: oklch(0.96 0.02 250);\n  --primary-base-soft-foreground: oklch(0.35 0.12 250);\n}\n\n@theme inline {\n  --color-primary-base: var(--primary-base);\n  --color-primary-base-foreground: var(--primary-base-foreground);\n}'
						}
					</code>
				</pre>
			</section>

			{/* 代码导出 */}
			<PaletteCodeExport palette={palette} seedHex={seedHex} />

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

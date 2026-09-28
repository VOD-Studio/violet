import { getContrastRatio, hexToOklch, oklchToRgb } from "@shared/lib/color-math";
import { CodeCard } from "@shared/ui/code-preview/components/CodeCard";
import { Button, HsvColorPicker, Segmented } from "@violet/ui";
import { type CSSProperties, useMemo, useState } from "react";
import { GuideLink, GuideSection } from "./GuideParts";

const VIOLET_SEED = oklchToRgb(0.53, 0.205, 286).hex;
const CORAL_SEED = oklchToRgb(0.625, 0.19, 25).hex;

/** 主色速选预设：与色板生成器共用同一组种子。 */
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

/** --radius 预设（rem）；上限 1rem 对齐站点 rounded-2xl 红线。 */
const RADIUS_PRESETS = ["0", "0.25", "0.5", "0.625", "0.75", "1"] as const;
type RadiusPreset = (typeof RADIUS_PRESETS)[number];
/** 与包内 tokens.css 的 --radius 默认一致。 */
const DEFAULT_RADIUS: RadiusPreset = "0.625";

type ScrollbarMode = "thin" | "default" | "none";
const DEFAULT_SCROLLBAR: ScrollbarMode = "default";

const RADIUS_SAMPLES = ["rounded-sm", "rounded-md", "rounded-lg"] as const;

const SCROLLBAR_DEMO_LINES = [
	"滚动容器 · 第 1 行",
	"滚动容器 · 第 2 行",
	"滚动容器 · 第 3 行",
	"滚动容器 · 第 4 行",
	"滚动容器 · 第 5 行",
	"滚动容器 · 第 6 行",
	"滚动容器 · 第 7 行",
	"滚动容器 · 第 8 行",
];

interface PrimaryBranch {
	base: string;
	foreground: string;
	hover: string;
	soft: string;
	softForeground: string;
	ring: string;
}

interface PrimaryVars {
	light: PrimaryBranch;
	dark: PrimaryBranch;
}

const clamp = (x: number, min: number, max: number) => Math.min(Math.max(x, min), max);

/** 数值序列化：去尾随零，286.0 → 286、0.530 → 0.53。 */
function fmt(n: number, digits = 3): string {
	const s = n.toFixed(digits);
	return s.includes(".") ? s.replace(/0+$/, "").replace(/\.$/, "") : s;
}

const ok = (l: number, c: number, h: number) => `oklch(${fmt(l)} ${fmt(c)} ${fmt(h, 1)})`;

/** 主色上的文字：白与墨两个候选，按对比度取胜者。 */
function pickForeground(base: string, h: number): string {
	const white = ok(0.99, 0, h);
	const ink = ok(0.14, 0.02, h);
	return getContrastRatio(white, base) >= getContrastRatio(ink, base) ? white : ink;
}

/**
 * 主色 → primary-base 六变量（浅深两支）。
 * 浅支：hover 降明度、soft 取高明度低彩度、soft-foreground 同色相深色、ring 与 base 同值；
 * 深支：base 明度 +0.09、彩度 ×0.78，其余按同一关系在深支基色上推导。
 */
function derivePrimaryVars(seed: { l: number; c: number; h: number }): PrimaryVars {
	const { l, c, h } = seed;
	const lightBase = ok(l, c, h);
	const darkL = clamp(l + 0.09, 0.2, 0.82);
	const darkC = c * 0.78;
	const darkBase = ok(darkL, darkC, h);
	return {
		light: {
			base: lightBase,
			foreground: pickForeground(lightBase, h),
			hover: ok(clamp(l - 0.05, 0.05, 0.95), c, h),
			soft: ok(0.95, c * 0.15, h),
			softForeground: ok(0.35, clamp(c * 0.7, 0, 0.32), h),
			ring: lightBase,
		},
		dark: {
			base: darkBase,
			foreground: pickForeground(darkBase, h),
			hover: ok(clamp(darkL + 0.05, 0.2, 0.87), darkC * 0.92, h),
			soft: ok(0.25, c * 0.18, h),
			softForeground: ok(0.9, clamp(c * 0.34, 0, 0.12), h),
			ring: darkBase,
		},
	};
}

const SCROLLBAR_NOTES: Record<ScrollbarMode, string> = {
	default: "\t/* 滚动条：default —— 保持浏览器默认形态，无需声明 */",
	thin: [
		"\t/* 滚动条：thin —— 全局生效时取消下面两行注释",
		"\tscrollbar-width: thin;",
		"\tscrollbar-color: var(--scrollbar-thumb) var(--scrollbar-track);",
		"\t*/",
	].join("\n"),
	none: [
		"\t/* 滚动条：none —— 隐藏全局滚动条时取消注释",
		"\tscrollbar-width: none;",
		"\t*/",
	].join("\n"),
};

/**
 * 组装可直接落盘的 custom.css：:root 作用域六个 --primary-base* 变量
 * （light-dark() 成对）+ --radius + 滚动条建议行，文件头注明入口导入位置。
 */
function buildCustomCss(vars: PrimaryVars, radius: RadiusPreset, scrollbar: ScrollbarMode): string {
	const pair = (key: keyof PrimaryBranch) => `light-dark(${vars.light[key]}, ${vars.dark[key]})`;
	return `/*
 * 主题构建器生成 · 保存为宿主 src/styles/palettes/custom.css。
 * 在应用入口样式（如 src/styles.css）中按顺序导入：
 *   @import "tailwindcss";
 *   @import "@violet/ui/styles.css";
 *   @import "./styles/palettes/custom.css";
 */
:root {
\t--primary-base: ${pair("base")};
\t--primary-base-foreground: ${pair("foreground")};
\t--primary-base-hover: ${pair("hover")};
\t--primary-base-soft: ${pair("soft")};
\t--primary-base-soft-foreground: ${pair("softForeground")};
\t--primary-base-ring: ${pair("ring")};

\t--radius: ${radius}rem;

${SCROLLBAR_NOTES[scrollbar]}
}
`;
}

type PreviewVars = CSSProperties & Record<`--${string}`, string>;

/** 主题构建器章内容：可视化调整主色、圆角与滚动条，实时预览并生成 custom.css。 */
export default function ThemeBuilderGuide() {
	const [seedHex, setSeedHex] = useState(DEFAULT_SEED);
	const [radius, setRadius] = useState<RadiusPreset>(DEFAULT_RADIUS);
	const [scrollbar, setScrollbar] = useState<ScrollbarMode>(DEFAULT_SCROLLBAR);

	const seed = useMemo(() => hexToOklch(seedHex), [seedHex]);
	const vars = useMemo(() => derivePrimaryVars(seed ?? { l: 0.53, c: 0.205, h: 286 }), [seed]);
	const customCss = useMemo(
		() => buildCustomCss(vars, radius, scrollbar),
		[vars, radius, scrollbar],
	);

	// 局部作用域注入：不写 :root，预览容器内的组件在使用点读取当前值。
	// --primary/--ring 一并重映射，使默认动作与焦点环同样跟随主色源
	//（同主题指南的 .campaign-theme 先例）。
	const previewVars: PreviewVars = {
		"--primary-base": `light-dark(${vars.light.base}, ${vars.dark.base})`,
		"--primary-base-foreground": `light-dark(${vars.light.foreground}, ${vars.dark.foreground})`,
		"--primary-base-hover": `light-dark(${vars.light.hover}, ${vars.dark.hover})`,
		"--primary-base-soft": `light-dark(${vars.light.soft}, ${vars.dark.soft})`,
		"--primary-base-soft-foreground": `light-dark(${vars.light.softForeground}, ${vars.dark.softForeground})`,
		"--primary-base-ring": `light-dark(${vars.light.ring}, ${vars.dark.ring})`,
		"--primary": "var(--primary-base)",
		"--primary-foreground": "var(--primary-base-foreground)",
		"--ring": "var(--primary-base-ring)",
		"--radius": `${radius}rem`,
	};

	return (
		<>
			<GuideSection title="调整主色、圆角与滚动条">
				<p>
					主色源六变量由一颗种子推导：悬停降明度、淡染底取高明度低彩度、
					淡染面前景取同色相深色、焦点环与基色同值；深色支整体提亮并压低彩度。
					调整只作用于本页预览，不写入站点主题。
				</p>
				<div className="rounded-2xl border border-border/40 bg-card/50 p-6">
					<div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
						{/* 左：主色拾取与速选 */}
						<div className="space-y-3">
							<span className="block text-xs font-semibold text-muted-foreground">
								主色
							</span>
							<HsvColorPicker onChange={setSeedHex} value={seedHex} />
							<div className="rounded-lg border border-border/40 bg-background/30 px-3 py-1.5 font-mono text-[11px] text-muted-foreground">
								{seed
									? `${seedHex.toUpperCase()} · oklch(${fmt(seed.l)} ${fmt(seed.c)} ${fmt(seed.h, 1)})`
									: "—"}
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

						{/* 右：圆角与滚动条 */}
						<div className="space-y-5 sm:pt-0">
							<div className="space-y-2">
								<span className="block text-xs font-semibold text-muted-foreground">
									圆角 --radius
								</span>
								<Segmented
									onValueChange={setRadius}
									segments={RADIUS_PRESETS.map((preset) => ({
										value: preset,
										label: preset,
									}))}
									value={radius}
								/>
								<p className="text-xs leading-5 text-muted-foreground">
									单位 rem，上限 1rem（rounded-2xl）；包默认 0.625。
								</p>
							</div>
							<div className="space-y-2">
								<span className="block text-xs font-semibold text-muted-foreground">
									滚动条模式
								</span>
								<Segmented
									onValueChange={setScrollbar}
									segments={[
										{ value: "thin", label: "纤细" },
										{ value: "default", label: "默认" },
										{ value: "none", label: "隐藏" },
									]}
									value={scrollbar}
								/>
								<p className="text-xs leading-5 text-muted-foreground">
									以建议行写进生成文件；局部容器可直接用 data-scrollbar 属性。
								</p>
							</div>
						</div>
					</div>
				</div>
			</GuideSection>

			<GuideSection title="实时预览与生成文件">
				<p>
					预览区在局部作用域套用当前参数：按钮与淡染面读主色源六变量， 圆角样例读
					--radius，滚动容器按所选模式渲染；浅深两支跟随站点明暗切换。
					生成内容与预览一致，可直接复制落盘。
				</p>
				<CodeCard
					collapseLines={0}
					code={customCss}
					language="css"
					title="src/styles/palettes/custom.css"
				>
					<div
						className="space-y-4 rounded-xl border border-border/40 bg-background/60 p-5"
						data-theme-preview="builder"
						style={previewVars}
					>
						<div className="flex flex-wrap items-center justify-center gap-3">
							<Button type="button">默认动作</Button>
							<Button type="button" variant="primary">
								主色强调
							</Button>
							<Button type="button" variant="soft">
								柔和淡染
							</Button>
						</div>
						<div className="flex flex-wrap items-end justify-center gap-4">
							{RADIUS_SAMPLES.map((utility) => (
								<div className="flex flex-col items-center gap-1.5" key={utility}>
									<span
										className={`size-12 border-2 border-primary-base bg-primary-base-soft ${utility}`}
									/>
									<span className="font-mono text-[10px] text-muted-foreground">
										{utility}
									</span>
								</div>
							))}
						</div>
						<div className="mx-auto max-w-md space-y-1">
							<div className="text-center text-xs text-muted-foreground">
								滚动条 · {scrollbar}
							</div>
							<div
								className="h-24 overflow-y-auto rounded-md border border-border/40 bg-card/60 p-2 text-xs leading-5 text-muted-foreground"
								data-scrollbar={scrollbar}
							>
								{SCROLLBAR_DEMO_LINES.map((line) => (
									<p key={line}>{line}</p>
								))}
							</div>
						</div>
					</div>
				</CodeCard>
				<p>
					保存为宿主 <code>src/styles/palettes/custom.css</code>
					，入口导入顺序见文件头注释。 六个变量的含义、局部作用域映射与完整主题机制见
					<GuideLink to="/design-system/guides/theming">主题指南</GuideLink>。
				</p>
			</GuideSection>
		</>
	);
}

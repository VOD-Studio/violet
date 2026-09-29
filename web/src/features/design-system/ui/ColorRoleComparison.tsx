import type { GeneratedPalette } from "@features/design-system/model/palette";
import { copyText } from "@shared/lib/clipboard";
import { slugify } from "@shared/lib/slug";
import { AnchoredHeading } from "@shared/ui/anchored-heading";
import { CartoonPopoverGroup, CartoonPopoverGroupItem } from "@shared/ui/cartoon-popover";
import { Settings2 } from "lucide-react";
import { type CSSProperties, type MouseEvent, type ReactElement, useId } from "react";
import { toast } from "sonner";

interface ColorRoleComparisonProps {
	palette: GeneratedPalette;
}

type PreviewMode = "light" | "dark";
type PreviewStyle = CSSProperties & Record<`--${string}`, string>;
type StatusKey = "info" | "success" | "warning" | "destructive";

interface SideBySideColor {
	base: string;
	foreground: string;
	hover: string;
	name: string;
	soft?: {
		base: string;
		foreground: string;
		hover: string;
	};
}

interface StackedColor {
	background: string;
	border?: boolean;
	label: string;
	token: string;
}

const textContrastStyle = (background: string): CSSProperties => ({
	WebkitBackgroundClip: "text",
	backgroundClip: "text",
	backgroundColor: background,
	color: "transparent",
	filter: "invert(1) grayscale(1) contrast(100)",
});

async function copyRenderedColor(event: MouseEvent<HTMLElement>, token: string) {
	const value = getComputedStyle(event.currentTarget).backgroundColor;
	if (await copyText(value)) {
		toast.success(`已复制 ${token}: ${value}`);
	}
}

function createPreviewStyle(palette: GeneratedPalette, mode: PreviewMode): PreviewStyle {
	const roleValues = Object.fromEntries(
		[...palette.primaryRoles, ...palette.neutral].map((role) => [role.role, role[mode].oklch]),
	);
	const functionalValues = Object.fromEntries(
		palette.functionalSets.map((set) => [set.key, set[mode]]),
	);
	const value = (role: string) => roleValues[role];
	const foreground = value("--foreground");
	const background = value("--background");
	const surface = value("--card");
	const muted = value("--muted");
	const mutedForeground = value("--muted-foreground");
	const primary = value("--primary");
	const primaryForeground = value("--primary-foreground");
	const primarySoft = value("--accent");
	const primarySoftForeground = value("--accent-foreground");

	return {
		"--background": background,
		"--background-secondary": `color-mix(in oklab, ${background} 96%, ${foreground} 4%)`,
		"--background-tertiary": `color-mix(in oklab, ${background} 92%, ${foreground} 8%)`,
		"--background-inverse": foreground,
		"--foreground": foreground,
		"--muted": mutedForeground,
		"--default": muted,
		"--default-hover": `color-mix(in oklab, ${muted} 94%, ${foreground} 6%)`,
		"--default-foreground": foreground,
		"--surface": surface,
		"--surface-foreground": foreground,
		"--surface-secondary": `color-mix(in oklab, ${surface} 95%, ${foreground} 5%)`,
		"--surface-tertiary": `color-mix(in oklab, ${surface} 90%, ${foreground} 10%)`,
		"--overlay": surface,
		"--overlay-foreground": foreground,
		"--segment": `color-mix(in oklab, ${surface} 86%, ${foreground} 14%)`,
		"--link": primary,
		"--primary-base": primary,
		"--primary-base-foreground": primaryForeground,
		"--primary-base-hover": value("--primary-hover"),
		"--primary-base-soft": primarySoft,
		"--primary-base-soft-hover": `color-mix(in oklab, ${primarySoft} 88%, ${primary} 12%)`,
		"--primary-base-soft-foreground": primarySoftForeground,
		"--primary-base-ring": primary,
		"--field-background": surface,
		"--field-hover": `color-mix(in oklab, ${surface} 92%, ${foreground} 8%)`,
		"--field-focus": surface,
		"--field-foreground": foreground,
		"--field-placeholder": mutedForeground,
		"--field-border": value("--input"),
		"--border": value("--border"),
		"--separator": value("--border"),
		"--separator-secondary": `color-mix(in oklab, ${surface} 85%, ${foreground} 15%)`,
		"--separator-tertiary": `color-mix(in oklab, ${surface} 81%, ${foreground} 19%)`,
		"--backdrop": mode === "light" ? "rgb(0 0 0 / 50%)" : "rgb(0 0 0 / 68%)",
		"--preview-contrast-border":
			mode === "light" ? "rgb(0 0 0 / 12%)" : "rgb(255 255 255 / 12%)",
		"--white": "oklch(1 0 0)",
		"--black": "oklch(0 0 0)",
		"--snow": "oklch(0.991 0 0)",
		"--eclipse": "oklch(0.21 0.006 286)",
		...Object.fromEntries(
			(Object.keys(functionalValues) as StatusKey[]).flatMap((key) => {
				const colors = functionalValues[key];
				return [
					[`--${key}`, colors.solid.oklch],
					[
						`--${key}-hover`,
						`color-mix(in oklab, ${colors.solid.oklch} 90%, ${colors.foreground.oklch} 10%)`,
					],
					[`--${key}-foreground`, colors.foreground.oklch],
					[`--${key}-soft`, colors.wash.oklch],
					[
						`--${key}-soft-hover`,
						`color-mix(in oklab, ${colors.wash.oklch} 88%, ${colors.solid.oklch} 12%)`,
					],
					[`--${key}-soft-foreground`, colors.washForeground.oklch],
				];
			}),
		),
	};
}

function SectionHeading({ description, title }: { description: string; title: string }) {
	return (
		<header>
			<AnchoredHeading
				as="h3"
				id={slugify(title)}
				className="text-xl font-semibold tracking-tight text-foreground"
			>
				{title}
			</AnchoredHeading>
			<p className="mt-3 max-w-4xl text-sm leading-7 text-muted-foreground">{description}</p>
		</header>
	);
}
function colorMixDefinition(
	firstToken: string,
	firstWeight: number,
	secondToken: string,
	secondWeight: number,
) {
	return [
		"color-mix(",
		"  in oklab,",
		`  var(${firstToken}) ${firstWeight}%,`,
		`  var(${secondToken}) ${secondWeight}%`,
		")",
	].join("\n");
}

const DERIVED_TOKEN_DEFINITIONS: Record<string, string> = {
	"--background-secondary": colorMixDefinition("--background", 96, "--foreground", 4),
	"--background-tertiary": colorMixDefinition("--background", 92, "--foreground", 8),
	"--default-hover": colorMixDefinition("--default", 94, "--foreground", 6),
	"--field-hover": colorMixDefinition("--field-background", 92, "--foreground", 8),
	"--primary-base-soft-hover": colorMixDefinition(
		"--primary-base-soft",
		88,
		"--primary-base",
		12,
	),
	"--segment": colorMixDefinition("--surface", 86, "--foreground", 14),
	"--separator-secondary": colorMixDefinition("--surface", 85, "--foreground", 15),
	"--separator-tertiary": colorMixDefinition("--surface", 81, "--foreground", 19),
	"--surface-secondary": colorMixDefinition("--surface", 95, "--foreground", 5),
	"--surface-tertiary": colorMixDefinition("--surface", 90, "--foreground", 10),
};

function getTokenDefinition(token: string) {
	const statusHover = token.match(/^--(info|success|warning|destructive)(-soft)?-hover$/);
	if (statusHover) {
		const baseToken = `--${statusHover[1]}`;
		return statusHover[2]
			? colorMixDefinition(`${baseToken}-soft`, 88, baseToken, 12)
			: colorMixDefinition(baseToken, 90, `${baseToken}-foreground`, 10);
	}

	return DERIVED_TOKEN_DEFINITIONS[token] ?? `var(${token})`;
}

function formatTokenDefinition(token: string) {
	const value = getTokenDefinition(token)
		.split("\n")
		.map((line) => `  ${line}`)
		.join("\n");
	return `--color-${token.slice(2)}:\n${value};`;
}

function ColorTokenPopover({ children, token }: { children: ReactElement; token: string }) {
	const itemId = useId();

	return (
		<CartoonPopoverGroupItem
			ariaLabel={`${token} 颜色定义`}
			className="w-full"
			showShine={false}
			side="top"
			trigger={children}
			value={`${itemId}-${token}`}
		>
			<pre className="overflow-x-auto whitespace-pre-wrap font-mono text-xs leading-6">
				<code>{formatTokenDefinition(token)}</code>
			</pre>
		</CartoonPopoverGroupItem>
	);
}

function ColorBlock({
	background,
	border = false,
	hoverBackground,
	label,
	token,
}: {
	background: string;
	border?: boolean;
	hoverBackground?: string;
	label: string;
	token: string;
}) {
	const style = {
		"--swatch-background": background,
		"--swatch-hover":
			hoverBackground ?? `color-mix(in oklab, ${background} 92%, var(--foreground) 8%)`,
	} as PreviewStyle;

	return (
		<ColorTokenPopover token={token}>
			<button
				className={`flex w-full cursor-pointer flex-col justify-center rounded-xl bg-(--swatch-background) px-4 py-2.5 text-left transition-colors duration-300 ease-out hover:bg-(--swatch-hover) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--primary-base-ring) ${
					border ? "border border-(--preview-contrast-border)" : ""
				}`}
				onClick={(event) => void copyRenderedColor(event, token)}
				style={style}
				title={`${token} · 点击复制当前值`}
				type="button"
			>
				<span
					className="text-sm font-medium tracking-tight"
					style={textContrastStyle(background)}
				>
					{label}
				</span>
				<span
					className="truncate font-mono text-[10px] leading-tight opacity-60 sm:hidden"
					style={textContrastStyle(background)}
				>
					{token}
				</span>
			</button>
		</ColorTokenPopover>
	);
}

function ColorHeader({
	background,
	hoverBackground,
	mode,
	name,
	token,
}: {
	background: string;
	hoverBackground: string;
	mode: PreviewMode;
	name: string;
	token: string;
}) {
	const style = {
		"--swatch-background": background,
		"--swatch-hover": hoverBackground,
	} as PreviewStyle;

	return (
		<ColorTokenPopover token={token}>
			<button
				className="flex w-full cursor-pointer items-center justify-between rounded-xl bg-(--swatch-background) px-4 py-3 text-left transition-colors duration-300 ease-out hover:bg-(--swatch-hover) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--primary-base-ring)"
				onClick={(event) => void copyRenderedColor(event, token)}
				style={style}
				title={`${token} · 点击复制当前值`}
				type="button"
			>
				<span className="flex flex-col">
					<span
						className="text-lg font-medium tracking-tight"
						style={textContrastStyle(background)}
					>
						{name}
					</span>
					<span
						className="font-mono text-[10px] leading-tight opacity-60 sm:hidden"
						style={textContrastStyle(background)}
					>
						{token}
					</span>
				</span>
				<span className="text-xs font-medium" style={textContrastStyle(background)}>
					{mode === "light" ? "Light" : "Dark"}
				</span>
			</button>
		</ColorTokenPopover>
	);
}

function ThemeColumn({
	color,
	mode,
	style,
}: {
	color: SideBySideColor;
	mode: PreviewMode;
	style: PreviewStyle;
}) {
	return (
		<div
			className="flex min-w-0 flex-1 flex-col gap-2"
			data-palette-preview={mode}
			style={{ ...style, colorScheme: mode }}
		>
			<ColorHeader
				background={`var(${color.base})`}
				hoverBackground={`var(${color.hover})`}
				mode={mode}
				name={color.name}
				token={color.base}
			/>
			<div className={`flex gap-2 ${color.soft ? "flex-col sm:flex-row" : "flex-col"}`}>
				<div
					className="flex min-w-0 flex-1 flex-col gap-1.5 rounded-xl p-3"
					style={{ backgroundColor: `var(${color.base})` }}
				>
					<span
						className="text-base font-medium tracking-tight"
						style={textContrastStyle(`var(${color.base})`)}
					>
						{color.name}
					</span>
					<ColorBlock
						background={`var(${color.hover})`}
						label="Hover"
						token={color.hover}
					/>
					<ColorBlock
						background={`var(${color.foreground})`}
						label="Foreground"
						token={color.foreground}
					/>
				</div>
				{color.soft ? (
					<div
						className="flex min-w-0 flex-1 flex-col gap-1.5 rounded-xl p-3"
						style={{
							backgroundColor: `var(${color.soft.base})`,
							color: `var(${color.soft.foreground})`,
						}}
					>
						<span className="text-base font-medium tracking-tight">
							{color.name} Soft
						</span>
						<ColorBlock
							background={`var(${color.soft.hover})`}
							border
							label="Hover"
							token={color.soft.hover}
						/>
						<ColorBlock
							background={`var(${color.soft.foreground})`}
							label="Foreground"
							token={color.soft.foreground}
						/>
					</div>
				) : null}
			</div>
		</div>
	);
}

function SideBySideSection({
	color,
	darkStyle,
	description,
	lightStyle,
	title,
}: {
	color: SideBySideColor;
	darkStyle: PreviewStyle;
	description: string;
	lightStyle: PreviewStyle;
	title: string;
}) {
	return (
		<section className="mt-12">
			<SectionHeading description={description} title={title} />
			<div className="mt-5 flex w-full flex-col gap-4 sm:flex-row">
				<ThemeColumn color={color} mode="light" style={lightStyle} />
				<ThemeColumn color={color} mode="dark" style={darkStyle} />
			</div>
		</section>
	);
}

function ThemeChip({ mode }: { mode: PreviewMode }) {
	return (
		<span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-(--border) bg-(--surface) px-2.5 py-1 text-[11px] font-medium text-(--foreground)">
			<Settings2 aria-hidden="true" className="size-3" />
			{mode === "light" ? "Light" : "Dark"}
		</span>
	);
}

function StackedSwatch({ background, border, label, token }: StackedColor) {
	return (
		<div className="min-w-0 basis-full sm:flex-1 sm:basis-0">
			<ColorBlock background={background} border={border} label={label} token={token} />
		</div>
	);
}

function StackedSection({
	darkColors,
	darkStyle,
	description,
	lightColors,
	lightStyle,
	title,
}: {
	darkColors: StackedColor[];
	darkStyle: PreviewStyle;
	description: string;
	lightColors: StackedColor[];
	lightStyle: PreviewStyle;
	title: string;
}) {
	return (
		<section className="mt-12">
			<SectionHeading description={description} title={title} />
			<div className="mt-5 flex w-full flex-col gap-4">
				{(
					[
						["light", lightColors, lightStyle],
						["dark", darkColors, darkStyle],
					] as const
				).map(([mode, colors, style]) => (
					<div
						data-palette-preview={mode}
						key={mode}
						style={{ ...style, colorScheme: mode }}
					>
						<div className="flex flex-col gap-2">
							<ThemeChip mode={mode} />
							<div className="flex flex-wrap gap-2 sm:flex-nowrap">
								{colors.map((color) => (
									<StackedSwatch
										key={`${color.token}-${color.label}`}
										{...color}
									/>
								))}
							</div>
						</div>
					</div>
				))}
			</div>
		</section>
	);
}

function FormFieldBlock({ mode, style }: { mode: PreviewMode; style: PreviewStyle }) {
	return (
		<div data-palette-preview={mode} style={{ ...style, colorScheme: mode }}>
			<div className="flex flex-col gap-2">
				<ThemeChip mode={mode} />
				<div className="flex flex-col gap-2 sm:flex-row">
					<div
						className="flex min-w-0 flex-1 flex-col gap-1.5 rounded-xl border border-(--preview-contrast-border) p-3"
						style={{ backgroundColor: "var(--field-background)" }}
					>
						<span
							className="text-base font-medium tracking-tight"
							style={textContrastStyle("var(--field-background)")}
						>
							Bg
						</span>
						<ColorBlock
							background="var(--field-hover)"
							border
							label="Hover"
							token="--field-hover"
						/>
						<ColorBlock
							background="var(--field-focus)"
							border
							label="Focus"
							token="--field-focus"
						/>
					</div>
					<div className="flex min-w-0 gap-2 sm:w-40 sm:flex-col">
						<StackedSwatch
							background="var(--field-placeholder)"
							label="Placeholder"
							token="--field-placeholder"
						/>
						<StackedSwatch
							background="var(--field-foreground)"
							label="Foreground"
							token="--field-foreground"
						/>
					</div>
				</div>
			</div>
		</div>
	);
}

function FormFieldSection({
	darkStyle,
	lightStyle,
}: {
	darkStyle: PreviewStyle;
	lightStyle: PreviewStyle;
}) {
	return (
		<section className="mt-12">
			<SectionHeading
				description="表单字段使用专用颜色覆盖默认、悬停、聚焦、占位与前景状态，使输入控件与按钮保持清晰区分。"
				title="表单字段"
			/>
			<div className="mt-5 flex w-full flex-col gap-4">
				<FormFieldBlock mode="light" style={lightStyle} />
				<FormFieldBlock mode="dark" style={darkStyle} />
			</div>
		</section>
	);
}

const PRIMARY_COLOR: SideBySideColor = {
	base: "--primary-base",
	foreground: "--primary-base-foreground",
	hover: "--primary-base-hover",
	name: "主色",
	soft: {
		base: "--primary-base-soft",
		foreground: "--primary-base-soft-foreground",
		hover: "--primary-base-soft-hover",
	},
};

const DEFAULT_COLOR: SideBySideColor = {
	base: "--default",
	foreground: "--default-foreground",
	hover: "--default-hover",
	name: "默认",
};

function statusColor(key: StatusKey, name: string): SideBySideColor {
	return {
		base: `--${key}`,
		foreground: `--${key}-foreground`,
		hover: `--${key}-hover`,
		name,
		soft: {
			base: `--${key}-soft`,
			foreground: `--${key}-soft-foreground`,
			hover: `--${key}-soft-hover`,
		},
	};
}

/**
 * 按语义章节并列展示生成色板的浅色与深色状态。
 *
 * @param props - 当前受控色板；变量只注入预览容器，不写入项目主题。
 */
export function ColorRoleComparison({ palette }: ColorRoleComparisonProps) {
	const lightStyle = createPreviewStyle(palette, "light");
	const darkStyle = createPreviewStyle(palette, "dark");
	const sameStacked = (colors: StackedColor[]) => colors;

	return (
		<div className="mt-12">
			{/* 全页共享一个气泡群组：跨章节移动时不出现第二个浮层叠加 */}
			<CartoonPopoverGroup className="block w-full">
				<div className="rounded-xl border border-border/50 bg-muted/30 px-4 py-3 text-sm leading-6 text-muted-foreground">
					这里是受控预览。切换上方主色只重算本页以下色块，不会写入根节点、持久化设置或改变项目主题。
				</div>

				<SideBySideSection
					color={PRIMARY_COLOR}
					darkStyle={darkStyle}
					description="主色代表产品的主识别色，用于关键操作、高亮与重点时刻。应节制使用；悬停、柔和背景和聚焦状态都从基础主色派生。"
					lightStyle={lightStyle}
					title="主色"
				/>
				<SideBySideSection
					color={DEFAULT_COLOR}
					darkStyle={darkStyle}
					description="默认色构成系统的中性骨架，用于大多数非强调的界面元素。"
					lightStyle={lightStyle}
					title="默认（中性色）"
				/>
				<SideBySideSection
					color={statusColor("info", "信息")}
					darkStyle={darkStyle}
					description="信息色传达客观说明与系统提示，不要求用户立即处理。"
					lightStyle={lightStyle}
					title="信息"
				/>
				<SideBySideSection
					color={statusColor("success", "成功")}
					darkStyle={darkStyle}
					description="成功色传达积极结果、确认与完成状态，常用于反馈、状态指示与校验通过。"
					lightStyle={lightStyle}
					title="成功"
				/>
				<SideBySideSection
					color={statusColor("warning", "警告")}
					darkStyle={darkStyle}
					description="警告色表示需谨慎、存在风险，或需要留意但非破坏性的过渡状态。"
					lightStyle={lightStyle}
					title="警告"
				/>
				<SideBySideSection
					color={statusColor("destructive", "危险")}
					darkStyle={darkStyle}
					description="危险色表示破坏性、不可逆或关键的操作与状态，应稳定用于错误、危险按钮与严重告警。"
					lightStyle={lightStyle}
					title="危险"
				/>

				<StackedSection
					darkColors={sameStacked([
						{
							background: "var(--foreground)",
							border: true,
							label: "前景",
							token: "--foreground",
						},
						{
							background: "var(--muted)",
							border: true,
							label: "弱化",
							token: "--muted",
						},
						{
							background: "var(--segment)",
							border: true,
							label: "分段",
							token: "--segment",
						},
						{
							background: "var(--overlay)",
							border: true,
							label: "遮罩",
							token: "--overlay",
						},
						{ background: "var(--link)", border: true, label: "链接", token: "--link" },
					])}
					darkStyle={darkStyle}
					description="前景色用于文字与图标，针对可读性优化并随背景上下文适配；组件内不应硬编码。"
					lightColors={sameStacked([
						{ background: "var(--foreground)", label: "前景", token: "--foreground" },
						{ background: "var(--muted)", label: "弱化", token: "--muted" },
						{
							background: "var(--segment)",
							border: true,
							label: "分段",
							token: "--segment",
						},
						{
							background: "var(--overlay)",
							border: true,
							label: "遮罩",
							token: "--overlay",
						},
						{ background: "var(--link)", label: "链接", token: "--link" },
					])}
					lightStyle={lightStyle}
					title="前景色"
				/>
				<StackedSection
					darkColors={sameStacked([
						{
							background: "var(--background)",
							border: true,
							label: "背景",
							token: "--background",
						},
						{
							background: "var(--background-secondary)",
							border: true,
							label: "次级",
							token: "--background-secondary",
						},
						{
							background: "var(--background-tertiary)",
							border: true,
							label: "第三级",
							token: "--background-tertiary",
						},
						{
							background: "var(--background-inverse)",
							border: true,
							label: "反色",
							token: "--background-inverse",
						},
					])}
					darkStyle={darkStyle}
					description="背景色定义界面的基底画布，在保持视觉克制的前提下建立整体对比与氛围。"
					lightColors={sameStacked([
						{
							background: "var(--background)",
							border: true,
							label: "背景",
							token: "--background",
						},
						{
							background: "var(--background-secondary)",
							border: true,
							label: "次级",
							token: "--background-secondary",
						},
						{
							background: "var(--background-tertiary)",
							border: true,
							label: "第三级",
							token: "--background-tertiary",
						},
						{
							background: "var(--background-inverse)",
							label: "反色",
							token: "--background-inverse",
						},
					])}
					lightStyle={lightStyle}
					title="背景色"
				/>
				<StackedSection
					darkColors={sameStacked([
						{
							background: "var(--surface)",
							border: true,
							label: "表面",
							token: "--surface",
						},
						{
							background: "var(--surface-secondary)",
							border: true,
							label: "次级",
							token: "--surface-secondary",
						},
						{
							background: "var(--surface-tertiary)",
							border: true,
							label: "第三级",
							token: "--surface-tertiary",
						},
					])}
					darkStyle={darkStyle}
					description="表面色叠在背景之上，用于卡片、面板、模态与下拉；层级来自抬升与对比，而非强烈色相跳跃。"
					lightColors={sameStacked([
						{
							background: "var(--surface)",
							border: true,
							label: "表面",
							token: "--surface",
						},
						{
							background: "var(--surface-secondary)",
							border: true,
							label: "次级",
							token: "--surface-secondary",
						},
						{
							background: "var(--surface-tertiary)",
							border: true,
							label: "第三级",
							token: "--surface-tertiary",
						},
					])}
					lightStyle={lightStyle}
					title="表面色"
				/>
				<FormFieldSection darkStyle={darkStyle} lightStyle={lightStyle} />
				<StackedSection
					darkColors={sameStacked([
						{
							background: "var(--separator)",
							border: true,
							label: "分隔线",
							token: "--separator",
						},
						{
							background: "var(--separator-secondary)",
							border: true,
							label: "次级",
							token: "--separator-secondary",
						},
						{
							background: "var(--separator-tertiary)",
							border: true,
							label: "第三级",
							token: "--separator-tertiary",
						},
					])}
					darkStyle={darkStyle}
					description="分隔线用于描边与轻量边界，应保持低对比，只组织内容而不抢夺注意力。"
					lightColors={sameStacked([
						{
							background: "var(--separator)",
							border: true,
							label: "分隔线",
							token: "--separator",
						},
						{
							background: "var(--separator-secondary)",
							border: true,
							label: "次级",
							token: "--separator-secondary",
						},
						{
							background: "var(--separator-tertiary)",
							border: true,
							label: "第三级",
							token: "--separator-tertiary",
						},
					])}
					lightStyle={lightStyle}
					title="分隔线"
				/>
				<StackedSection
					darkColors={sameStacked([
						{
							background: "var(--border)",
							border: true,
							label: "边框",
							token: "--border",
						},
						{ background: "var(--backdrop)", label: "背衬", token: "--backdrop" },
						{
							background: "var(--overlay)",
							border: true,
							label: "遮罩",
							token: "--overlay",
						},
						{
							background: "var(--segment)",
							border: true,
							label: "分段",
							token: "--segment",
						},
					])}
					darkStyle={darkStyle}
					description="其他颜色承担特定工具性角色，用于边界、背衬与浮层组织。"
					lightColors={sameStacked([
						{
							background: "var(--border)",
							border: true,
							label: "边框",
							token: "--border",
						},
						{ background: "var(--backdrop)", label: "背衬", token: "--backdrop" },
						{
							background: "var(--overlay)",
							border: true,
							label: "遮罩",
							token: "--overlay",
						},
						{
							background: "var(--segment)",
							border: true,
							label: "分段",
							token: "--segment",
						},
					])}
					lightStyle={lightStyle}
					title="其他"
				/>
				<section className="mt-12">
					<SectionHeading
						description="基础色是模式无关的底层取值，作为语义角色的根基，在明暗主题之间保持不变。"
						title="基础色"
					/>
					<div style={lightStyle}>
						<div className="mt-5 flex w-full flex-wrap gap-2 sm:flex-nowrap">
							{[
								{
									background: "var(--white)",
									border: true,
									label: "白",
									token: "--white",
								},
								{ background: "var(--black)", label: "黑", token: "--black" },
								{
									background: "var(--snow)",
									border: true,
									label: "雪白",
									token: "--snow",
								},
								{ background: "var(--eclipse)", label: "月蚀", token: "--eclipse" },
							].map((color) => (
								<StackedSwatch key={color.token} {...color} />
							))}
						</div>
					</div>
				</section>
			</CartoonPopoverGroup>
		</div>
	);
}

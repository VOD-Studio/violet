import { copyText } from "@shared/lib/clipboard";
import { hexToOklch, oklchToRgb, parseOklch } from "@shared/lib/color-math";
import { HsvColorPicker } from "@shared/ui/color-picker";
import { Segmented } from "@shared/ui/segmented";
import { AlertCircle, AlertTriangle, Check, CheckCircle2, Copy, Info } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import type { GeneratedPalette, RampStep, RoleColor, SwatchColor } from "../model/palette";
import { generatePalette } from "../model/palette";

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

const DEFAULT_SEED = "#2563eb";

function SwatchButton({
	color,
	domain,
	copied,
	onPick,
}: {
	color: SwatchColor;
	domain: string;
	copied: boolean;
	onPick: () => void;
}) {
	const ink = (parseOklch(color.oklch)?.l ?? 0.5) < 0.62 ? "text-white" : "text-slate-900";
	return (
		<button
			className={`relative h-9 w-full overflow-hidden rounded-lg outline-none ring-1 ring-border/60 transition-[filter] duration-150 ease-out hover:brightness-105 ${ink}`}
			onClick={onPick}
			style={{ backgroundColor: color.hex }}
			title={`${domain} · ${color.oklch}`}
			type="button"
		>
			<span
				aria-hidden={copied}
				className={`absolute inset-0 flex items-center justify-center font-mono text-[10px] font-semibold tracking-wide transition-opacity duration-150 ease-out ${
					copied ? "opacity-100" : "opacity-0 group-hover:opacity-100"
				}`}
			>
				{copied ? "✓" : color.hex.toUpperCase()}
			</span>
		</button>
	);
}

function RoleRow({ role }: { role: RoleColor }) {
	const [copiedDomain, setCopiedDomain] = useState<"light" | "dark" | null>(null);
	const pick = async (domain: "light" | "dark") => {
		const hex = role[domain].hex.toUpperCase();
		if (await copyText(hex)) {
			toast.success(`已复制 ${role.role} ${domain === "light" ? "浅色" : "深色"}: ${hex}`);
			setCopiedDomain(domain);
			setTimeout(() => setCopiedDomain(null), 1200);
		}
	};
	return (
		<li className="group grid grid-cols-[1fr_6.5rem_6.5rem] items-center gap-x-4 rounded-xl px-3 py-2 transition-colors duration-150 hover:bg-muted/40 sm:grid-cols-[1fr_9rem_9rem]">
			<div className="min-w-0">
				<code className="font-mono text-xs font-medium">{role.role}</code>
				{role.note ? (
					<span className="ml-2 text-xs text-muted-foreground">{role.note}</span>
				) : null}
			</div>
			<SwatchButton
				color={role.light}
				copied={copiedDomain === "light"}
				domain="浅"
				onPick={() => void pick("light")}
			/>
			<SwatchButton
				color={role.dark}
				copied={copiedDomain === "dark"}
				domain="深"
				onPick={() => void pick("dark")}
			/>
		</li>
	);
}

/** 角色展台：与全站布局规格线格保持一致，行悬停聚焦，色块悬停显值、点击复制 */
function RoleBoard({ title, roles }: { title: string; roles: RoleColor[] }) {
	return (
		<section>
			<h3 className="mt-10 text-lg font-bold">{title}</h3>
			<ul className="mt-2 grid grid-cols-[1fr_6.5rem_6.5rem] gap-x-4 px-3 pb-1.5 sm:grid-cols-[1fr_9rem_9rem]">
				<span className="font-mono text-[11px] text-muted-foreground">角色</span>
				<span className="text-center font-mono text-[11px] text-muted-foreground">
					浅色
				</span>
				<span className="text-center font-mono text-[11px] text-muted-foreground">
					深色
				</span>
			</ul>
			<ul className="mt-0 space-y-0.5">
				{roles.map((role) => (
					<RoleRow key={role.role} role={role} />
				))}
			</ul>
		</section>
	);
}

/**
 * 实时组件试穿沙盒：将当前色彩算法推导的主色、强调色、功能色动态注入真实组件样例。
 * 遵循现代极简美学：卡片纯净中性底、发丝微边框、精准微光点缀。
 */
function LiveComponentSandbox({ palette }: { palette: GeneratedPalette }) {
	const primaryLight = palette.primaryRoles[0].light.hex;
	const primaryFgLight = palette.primaryRoles[2].light.hex;
	const accentLight = palette.primaryRoles[3].light.hex;
	const accentFgLight = palette.primaryRoles[4].light.hex;

	const [switchOn, setSwitchOn] = useState(true);
	const [activeTab, setActiveTab] = useState<"actions" | "alerts">("actions");

	const { functionalSets } = palette;
	const infoSet = functionalSets.find((s) => s.key === "info") ?? functionalSets[0];
	const successSet = functionalSets.find((s) => s.key === "success") ?? functionalSets[1];
	const warningSet = functionalSets.find((s) => s.key === "warning") ?? functionalSets[2];
	const destructiveSet = functionalSets.find((s) => s.key === "destructive") ?? functionalSets[3];

	return (
		<section className="mt-10">
			<div className="flex flex-wrap items-baseline justify-between gap-2">
				<h3 className="text-lg font-bold">组件试穿沙盒</h3>
				<Segmented<"actions" | "alerts">
					onValueChange={setActiveTab}
					segments={[
						{ value: "actions", label: "动作与控件" },
						{ value: "alerts", label: "状态反馈横幅" },
					]}
					size="sm"
					value={activeTab}
				/>
			</div>

			<div className="mt-4 rounded-2xl border border-border/40 bg-card/50 p-6">
				{activeTab === "actions" ? (
					<div className="space-y-6">
						{/* 按钮群组 */}
						<div>
							<span className="block text-xs font-medium text-muted-foreground">
								按钮与动作
							</span>
							<div className="mt-3 flex flex-wrap items-center gap-3">
								<button
									className="rounded-lg px-4 py-2 text-xs font-semibold shadow-xs transition-opacity hover:opacity-90"
									style={{ backgroundColor: primaryLight, color: primaryFgLight }}
									type="button"
								>
									主要动作 Primary
								</button>
								<button
									className="rounded-lg px-4 py-2 text-xs font-medium transition-colors"
									style={{ backgroundColor: accentLight, color: accentFgLight }}
									type="button"
								>
									淡染强调 Accent
								</button>
								<button
									className="rounded-lg border px-4 py-2 text-xs font-medium transition-colors hover:bg-muted/40"
									style={{ borderColor: primaryLight, color: primaryLight }}
									type="button"
								>
									轮廓动作 Outline
								</button>
								<button
									className="rounded-lg px-4 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
									type="button"
								>
									幽灵动作 Ghost
								</button>
								<button
									className="cursor-not-allowed rounded-lg border border-border/40 bg-muted/30 px-4 py-2 text-xs text-muted-foreground/60"
									disabled
									type="button"
								>
									禁用动作 Disabled
								</button>
							</div>
						</div>

						{/* 徽章胶囊与控件 */}
						<div className="grid grid-cols-1 gap-6 border-t border-border/40 pt-4 sm:grid-cols-2">
							<div>
								<span className="block text-xs font-medium text-muted-foreground">
									徽章与标签
								</span>
								<div className="mt-3 flex flex-wrap items-center gap-2">
									<span
										className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
										style={{
											backgroundColor: primaryLight,
											color: primaryFgLight,
										}}
									>
										主色徽标
									</span>
									<span
										className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
										style={{
											backgroundColor: accentLight,
											color: accentFgLight,
										}}
									>
										淡染胶囊
									</span>
									<span
										className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium"
										style={{ borderColor: primaryLight, color: primaryLight }}
									>
										描边标签
									</span>
								</div>
							</div>

							<div>
								<span className="block text-xs font-medium text-muted-foreground">
									表单与焦点环
								</span>
								<div className="mt-3 flex items-center gap-4">
									<input
										className="h-8 w-44 rounded-md border border-border/60 bg-transparent px-2.5 text-xs outline-none transition-shadow"
										placeholder="带焦点环的输入框..."
										style={{
											boxShadow: `0 0 0 1.5px ${primaryLight}`,
										}}
										type="text"
									/>
									<button
										aria-label="沙盒开关状态"
										className="relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out"
										onClick={() => setSwitchOn(!switchOn)}
										style={{
											backgroundColor: switchOn ? primaryLight : undefined,
										}}
										type="button"
									>
										<span
											className={`pointer-events-none inline-block size-4 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
												switchOn ? "translate-x-4.5" : "translate-x-0.5"
											} mt-0.5`}
										/>
									</button>
									<span className="text-xs text-muted-foreground">
										{switchOn ? "开启" : "关闭"}
									</span>
								</div>
							</div>
						</div>
					</div>
				) : (
					<div className="space-y-3">
						{/* 成功状态 */}
						<div className="group relative flex items-start gap-3.5 rounded-xl border border-border/60 bg-card/70 p-3.5 transition-colors hover:border-border">
							<div
								className="flex size-7 shrink-0 items-center justify-center rounded-lg"
								style={{
									backgroundColor: `${successSet.light.solid.hex}15`,
									color: successSet.light.solid.hex,
								}}
							>
								<CheckCircle2 className="size-4" />
							</div>
							<div className="min-w-0 flex-1">
								<div className="flex items-center gap-2">
									<h5 className="text-xs font-semibold text-foreground">
										操作成功
									</h5>
									<span
										className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium"
										style={{
											backgroundColor: `${successSet.light.solid.hex}12`,
											color: successSet.light.solid.hex,
										}}
									>
										已同步
									</span>
								</div>
								<p className="mt-1 text-xs leading-relaxed text-muted-foreground">
									数据已正常更新并同步至各端。
								</p>
							</div>
						</div>

						{/* 警示状态 */}
						<div className="group relative flex items-start gap-3.5 rounded-xl border border-border/60 bg-card/70 p-3.5 transition-colors hover:border-border">
							<div
								className="flex size-7 shrink-0 items-center justify-center rounded-lg"
								style={{
									backgroundColor: `${warningSet.light.solid.hex}15`,
									color: warningSet.light.solid.hex,
								}}
							>
								<AlertTriangle className="size-4" />
							</div>
							<div className="min-w-0 flex-1">
								<div className="flex items-center gap-2">
									<h5 className="text-xs font-semibold text-foreground">
										待决变更
									</h5>
									<span
										className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium"
										style={{
											backgroundColor: `${warningSet.light.solid.hex}12`,
											color: warningSet.light.solid.hex,
										}}
									>
										需确认
									</span>
								</div>
								<p className="mt-1 text-xs leading-relaxed text-muted-foreground">
									部分配置尚未确认，切换分支前请先保存当前修改。
								</p>
							</div>
						</div>

						{/* 危险状态 */}
						<div className="group relative flex items-start gap-3.5 rounded-xl border border-border/60 bg-card/70 p-3.5 transition-colors hover:border-border">
							<div
								className="flex size-7 shrink-0 items-center justify-center rounded-lg"
								style={{
									backgroundColor: `${destructiveSet.light.solid.hex}15`,
									color: destructiveSet.light.solid.hex,
								}}
							>
								<AlertCircle className="size-4" />
							</div>
							<div className="min-w-0 flex-1">
								<div className="flex items-center gap-2">
									<h5 className="text-xs font-semibold text-foreground">
										阻断提醒
									</h5>
									<span
										className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium"
										style={{
											backgroundColor: `${destructiveSet.light.solid.hex}12`,
											color: destructiveSet.light.solid.hex,
										}}
									>
										不可逆
									</span>
								</div>
								<p className="mt-1 text-xs leading-relaxed text-muted-foreground">
									此操作将永久清理选中项目，请再次核验目标对象。
								</p>
							</div>
						</div>

						{/* 提示状态 */}
						<div className="group relative flex items-start gap-3.5 rounded-xl border border-border/60 bg-card/70 p-3.5 transition-colors hover:border-border">
							<div
								className="flex size-7 shrink-0 items-center justify-center rounded-lg"
								style={{
									backgroundColor: `${infoSet.light.solid.hex}15`,
									color: infoSet.light.solid.hex,
								}}
							>
								<Info className="size-4" />
							</div>
							<div className="min-w-0 flex-1">
								<div className="flex items-center gap-2">
									<h5 className="text-xs font-semibold text-foreground">
										系统说明
									</h5>
									<span
										className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium"
										style={{
											backgroundColor: `${infoSet.light.solid.hex}12`,
											color: infoSet.light.solid.hex,
										}}
									>
										提示
									</span>
								</div>
								<p className="mt-1 text-xs leading-relaxed text-muted-foreground">
									色相与彩度由固定语义模型解算，明暗双域自适应。
								</p>
							</div>
						</div>
					</div>
				)}
			</div>
		</section>
	);
}

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
  --brand: ${palette.primaryRoles[0].light.oklch};
  --brand-foreground: ${palette.primaryRoles[2].light.oklch};
  --brand-hover: ${palette.primaryRoles[1].light.oklch};
  --brand-wash: ${palette.primaryRoles[3].light.oklch};
  --brand-wash-foreground: ${palette.primaryRoles[4].light.oklch};
  --brand-ring: ${palette.primaryRoles[0].light.oklch};

  /* 状态功能色 */
  --destructive: ${palette.functional[3].light.oklch};
  --warning: ${palette.functional[2].light.oklch};
  --success: ${palette.functional[1].light.oklch};
  --info: ${palette.functional[0].light.oklch};
}

.dark {
  --brand: ${palette.primaryRoles[0].dark.oklch};
  --brand-foreground: ${palette.primaryRoles[2].dark.oklch};
  --brand-hover: ${palette.primaryRoles[1].dark.oklch};
  --brand-wash: ${palette.primaryRoles[3].dark.oklch};
  --brand-wash-foreground: ${palette.primaryRoles[4].dark.oklch};
  --brand-ring: ${palette.primaryRoles[0].dark.oklch};

  /* 状态功能色 */
  --destructive: ${palette.functional[3].dark.oklch};
  --warning: ${palette.functional[2].dark.oklch};
  --success: ${palette.functional[1].dark.oklch};
  --info: ${palette.functional[0].dark.oklch};
}`;
		}

		return `/* —— Tailwind CSS v4 色阶定义 —— */
@theme inline {
  --color-brand-50: ${palette.ramp[0].hex};
  --color-brand-100: ${palette.ramp[1].hex};
  --color-brand-200: ${palette.ramp[2].hex};
  --color-brand-300: ${palette.ramp[3].hex};
  --color-brand-400: ${palette.ramp[4].hex};
  --color-brand-500: ${palette.ramp[5].hex};
  --color-brand-600: ${palette.ramp[6].hex};
  --color-brand-700: ${palette.ramp[7].hex};
  --color-brand-800: ${palette.ramp[8].hex};
  --color-brand-900: ${palette.ramp[9].hex};
  --color-brand-950: ${palette.ramp[10].hex};
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
 * 色板生成器章内容：给一个主色，色阶、主色与强调、功能色、中性带
 * 全部由此推导（明暗双域并列预览），核心配对附 WCAG 对比度审计。
 */
export function PaletteGenerator() {
	const [seedHex, setSeedHex] = useState(DEFAULT_SEED);
	const [hoverRamp, setHoverRamp] = useState<string | null>(null);
	const [copiedRamp, setCopiedRamp] = useState<string | null>(null);

	const palette = useMemo(() => {
		const parsed = hexToOklch(seedHex);
		const h = Math.round(parsed?.h ?? 222);
		const c = Math.min(Math.max(parsed?.c ?? 0.16, 0.04), 0.3);
		return generatePalette({ h, c });
	}, [seedHex]);

	const seed = hexToOklch(seedHex);

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
			{/* 品牌色阶卡尺 */}
			<div className="mt-10 flex flex-wrap items-baseline justify-between gap-2">
				<h3 className="text-lg font-bold">品牌色阶</h3>
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

			{/* 实时组件沙盒 */}
			<LiveComponentSandbox palette={palette} />

			{/* 主色与强调 */}
			<RoleBoard roles={palette.primaryRoles} title="主色与强调" />

			{/* 功能色：与全站布局规格与角色展台完全统一 */}
			<RoleBoard roles={palette.functional} title="功能色" />

			{/* 中性带 */}
			<RoleBoard roles={palette.neutral} title="中性带" />

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

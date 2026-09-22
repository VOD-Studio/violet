import { copyText } from "@shared/lib/clipboard";
import { hexToOklch, oklchToRgb } from "@shared/lib/color-math";
import { HsvColorPicker } from "@shared/ui/color-picker";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import type { RampStep, RoleColor, SwatchColor } from "../model/palette";
import { generatePalette } from "../model/palette";

// 备选主色里的两枚站内典藏：现役冷香紫罗兰与曾用暖珊瑚（值取自各自 palette 定义）
const VIOLET_SEED = oklchToRgb(0.53, 0.205, 286).hex;
const CORAL_SEED = oklchToRgb(0.625, 0.19, 25).hex;

/** 主色速选：站内典藏在前，拿不准时一键落到一枚顺眼的主色 */
const SEED_PRESETS = [
	{ hex: VIOLET_SEED, name: "紫罗兰 · 现役预设" },
	{ hex: CORAL_SEED, name: "暖珊瑚 · 曾用预设" },
	{ hex: "#2563eb", name: "靛蓝" },
	{ hex: "#0891b2", name: "青" },
	{ hex: "#059669", name: "松绿" },
	{ hex: "#65a30d", name: "橄榄" },
	{ hex: "#d97706", name: "暖橙" },
	{ hex: "#dc2626", name: "绯红" },
	{ hex: "#db2777", name: "玫红" },
] as const;

const DEFAULT_SEED = "#2563eb";

const clamp = (x: number, min: number, max: number) => Math.min(Math.max(x, min), max);

function ColorCell({ color }: { color: SwatchColor }) {
	return (
		<span className="inline-flex items-center gap-1.5">
			<span
				className="inline-block size-5 rounded-2 border border-border/60 transition-colors duration-300 ease-out"
				style={{ backgroundColor: color.hex }}
				title={color.oklch}
			/>
			<code className="font-mono text-[10px] text-muted-foreground">{color.hex}</code>
		</span>
	);
}

function RoleHeader() {
	return (
		<li className="grid grid-cols-1 gap-x-6 sm:grid-cols-[1fr_auto_auto] sm:items-baseline">
			<span className="font-mono text-xs text-muted-foreground">角色</span>
			<span className="hidden font-mono text-xs text-muted-foreground sm:inline">浅色</span>
			<span className="hidden font-mono text-xs text-muted-foreground sm:inline">深色</span>
		</li>
	);
}

function RoleRow({ role }: { role: RoleColor }) {
	return (
		<li className="grid grid-cols-1 gap-x-6 gap-y-1 border-b border-border/40 py-2.5 sm:grid-cols-[1fr_auto_auto] sm:items-baseline">
			<span className="min-w-0">
				<code className="font-mono text-xs">{role.role}</code>
				{role.note ? (
					<span className="ml-2 text-xs text-muted-foreground">{role.note}</span>
				) : null}
			</span>
			<span className="sm:justify-self-end">
				<ColorCell color={role.light} />
			</span>
			<span className="sm:justify-self-end">
				<ColorCell color={role.dark} />
			</span>
		</li>
	);
}

/**
 * 色板生成器章内容：给一个主色，色阶、品牌角色、功能色、中性带与
 * 语义角色全部由此推导（明暗双域并列预览），核心配对附 WCAG 对比度审计。
 */
export function PaletteGenerator() {
	const [seedHex, setSeedHex] = useState(DEFAULT_SEED);
	const [hoverRamp, setHoverRamp] = useState<string | null>(null);
	const [copiedRamp, setCopiedRamp] = useState<string | null>(null);
	const palette = useMemo(() => {
		const parsed = hexToOklch(seedHex);
		const h = Math.round(parsed?.h ?? 222);
		// 彩度钳到可入界面的克制区间；取到近灰主色时整板随之素净
		const c = clamp(parsed?.c ?? 0.16, 0.04, 0.3);
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
			<div className="rounded-2xl border border-border/40 bg-card/50 p-6">
				<div className="flex flex-wrap items-start gap-x-10 gap-y-5">
					<div className="flex items-center gap-4">
						<div
							className="size-16 shrink-0 rounded-2xl ring-1 ring-border transition-colors duration-300 ease-out"
							style={{ backgroundColor: seedHex }}
						/>
						<div>
							<p className="text-base font-bold">主色</p>
							<code className="block font-mono text-xs text-muted-foreground tabular-nums">
								{seedHex.toUpperCase()}
							</code>
							<code className="block font-mono text-xs text-muted-foreground tabular-nums">
								{seed
									? `oklch(${seed.l.toFixed(3)} ${seed.c.toFixed(3)} ${seed.h.toFixed(1)})`
									: "—"}
							</code>
							<p className="mt-1 text-xs text-muted-foreground">
								给一个主色，其余全部由此推导。
							</p>
						</div>
					</div>
					<div
						aria-label="主色速选"
						className="flex flex-wrap items-center gap-2.5"
						role="group"
					>
						{SEED_PRESETS.map((preset) => (
							<button
								aria-label={`主色 ${preset.name}`}
								className={`size-8 rounded-full ring-1 transition-[background-color,box-shadow] duration-300 ease-out ${
									seedHex === preset.hex
										? "ring-2 ring-foreground"
										: "ring-border hover:ring-foreground/40"
								}`}
								key={preset.hex}
								onClick={() => setSeedHex(preset.hex)}
								style={{ backgroundColor: preset.hex }}
								title={preset.name}
								type="button"
							/>
						))}
					</div>
				</div>
				<div className="mt-6 max-w-72 border-t border-border/40 pt-5">
					<p className="mb-3 text-xs text-muted-foreground">自定义主色</p>
					<HsvColorPicker onChange={setSeedHex} value={seedHex} />
				</div>
			</div>

			<h3 className="mt-10 text-lg font-bold">品牌色阶</h3>
			<div className="mt-3 overflow-hidden rounded-2xl border border-border/40">
				<div className="grid grid-cols-11">
					{palette.ramp.map((step, i) => (
						<button
							aria-label={`色阶 ${step.label} · ${step.hex.toUpperCase()}`}
							className="relative h-20 outline-none"
							key={step.label}
							onMouseEnter={() => setHoverRamp(step.label)}
							onMouseLeave={() => setHoverRamp(null)}
							onClick={() => void pickRamp(step)}
							style={{ backgroundColor: step.hex }}
							title={`${step.label} · ${step.hex.toUpperCase()}`}
							type="button"
						>
							<span
								className={`pointer-events-none absolute inset-0 flex items-center justify-center font-mono text-[10px] font-semibold whitespace-nowrap transition-opacity duration-200 ease-out ${
									hoverRamp === step.label ? "opacity-100" : "opacity-0"
								} ${i >= 5 ? "text-white" : "text-slate-900"}`}
							>
								{step.hex.toUpperCase()}
							</span>
						</button>
					))}
				</div>
			</div>
			<div className="mt-2 grid grid-cols-11" aria-hidden="true">
				{palette.ramp.map((step) => (
					<span
						className={`text-center font-mono text-[10px] tabular-nums transition-colors duration-200 ease-out ${
							hoverRamp === step.label || copiedRamp === step.label
								? "text-foreground"
								: "text-muted-foreground"
						}`}
						key={step.label}
					>
						{step.label}
					</span>
				))}
			</div>

			<h3 className="mt-10 text-lg font-bold">品牌角色</h3>
			<ul className="mt-3">
				<RoleHeader />
				{palette.brandRoles.map((role) => (
					<RoleRow key={role.role} role={role} />
				))}
			</ul>

			<h3 className="mt-10 text-lg font-bold">功能色</h3>
			<ul className="mt-3">
				<RoleHeader />
				{palette.functional.map((role) => (
					<RoleRow key={role.role} role={role} />
				))}
			</ul>

			<h3 className="mt-10 text-lg font-bold">中性带与语义角色</h3>
			<ul className="mt-3">
				<RoleHeader />
				{palette.semantic.map((role) => (
					<RoleRow key={role.role} role={role} />
				))}
			</ul>

			<h3 className="mt-10 text-lg font-bold">对比度审计</h3>
			<ul className="mt-3">
				{palette.audits.map((audit) => (
					<li
						className="flex items-baseline gap-3 border-b border-border/40 py-2 text-sm"
						key={audit.pair}
					>
						<span className={audit.pass ? "text-success" : "text-destructive"}>
							{audit.pass ? "✓" : "✗"}
						</span>
						<span className="flex-1 text-muted-foreground">{audit.pair}</span>
						<code className="font-mono text-xs">{audit.ratio}:1</code>
						<span className="w-20 text-right font-mono text-xs text-muted-foreground">
							{audit.rating}
						</span>
					</li>
				))}
			</ul>
		</div>
	);
}

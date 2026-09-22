import { copyText } from "@shared/lib/clipboard";
import { hexToOklch, oklchToRgb, parseOklch } from "@shared/lib/color-math";
import { HsvColorPicker } from "@shared/ui/color-picker";
import { motion } from "framer-motion";
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
	// 墨色随色块自身明度切换：主题 token 在深浅域会失配
	const ink = (parseOklch(color.oklch)?.l ?? 0.5) < 0.62 ? "text-white" : "text-slate-900";
	return (
		<button
			className={`relative h-9 w-full overflow-hidden rounded-lg outline-none ring-1 ring-border/60 transition-[filter] duration-300 ease-out hover:brightness-110 ${ink}`}
			onClick={onPick}
			style={{ backgroundColor: color.hex }}
			title={`${domain} · ${color.oklch}`}
			type="button"
		>
			<span
				aria-hidden={copied}
				className={`absolute inset-0 flex items-center justify-center font-mono text-[10px] font-semibold tracking-wide transition-opacity duration-200 ease-out ${
					copied ? "opacity-100" : "opacity-0 group-hover:opacity-100"
				}`}
			>
				{copied ? "✓" : color.hex.toUpperCase()}
			</span>
		</button>
	);
}

function RoleRow({ role }: { role: RoleColor }) {
	const [copied, setCopied] = useState(false);
	const pick = async (domain: "light" | "dark") => {
		const hex = role[domain].hex.toUpperCase();
		if (await copyText(hex)) {
			toast.success(`已复制 ${role.role} ${domain === "light" ? "浅色" : "深色"}: ${hex}`);
			setCopied(true);
			setTimeout(() => setCopied(false), 1200);
		}
	};
	return (
		<li className="group grid grid-cols-[1fr_6.5rem_6.5rem] items-center gap-x-4 rounded-xl px-3 py-2 transition-colors duration-200 ease-out hover:bg-muted/40 sm:grid-cols-[1fr_9rem_9rem]">
			<div className="min-w-0">
				<code className="font-mono text-xs">{role.role}</code>
				{role.note ? (
					<span className="ml-2 text-xs text-muted-foreground">{role.note}</span>
				) : null}
			</div>
			<SwatchButton
				color={role.light}
				copied={copied}
				domain="浅"
				onPick={() => void pick("light")}
			/>
			<SwatchButton
				color={role.dark}
				copied={copied}
				domain="深"
				onPick={() => void pick("dark")}
			/>
		</li>
	);
}

/** 角色展台：滚动入场淡入，行悬停聚焦，色块悬停显值、点击复制 */
function RoleBoard({ title, roles }: { title: string; roles: RoleColor[] }) {
	return (
		<motion.section
			initial={{ opacity: 0 }}
			transition={{ duration: 0.45, ease: "easeOut" }}
			viewport={{ margin: "-60px", once: true }}
			whileInView={{ opacity: 1 }}
		>
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
		</motion.section>
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

			<RoleBoard roles={palette.primaryRoles} title="主色与强调" />

			<RoleBoard roles={palette.functional} title="功能色" />

			<RoleBoard roles={palette.neutral} title="中性带" />

			<motion.section
				initial={{ opacity: 0 }}
				transition={{ duration: 0.45, ease: "easeOut" }}
				viewport={{ margin: "-60px", once: true }}
				whileInView={{ opacity: 1 }}
			>
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
			</motion.section>
		</div>
	);
}

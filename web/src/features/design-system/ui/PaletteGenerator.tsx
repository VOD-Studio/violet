import { useMemo, useState } from "react";
import type { RoleColor, SwatchColor } from "../model/palette";
import { generatePalette } from "../model/palette";

/** 常用色相速选，含现行种子的对照位 */
const HUE_PRESETS = [
	{ h: 222, name: "靛蓝" },
	{ h: 195, name: "青" },
	{ h: 150, name: "松绿" },
	{ h: 85, name: "橄榄" },
	{ h: 55, name: "暖黄" },
	{ h: 25, name: "赭" },
] as const;

function ColorCell({ color }: { color: SwatchColor }) {
	return (
		<span className="inline-flex items-center gap-1.5">
			<span
				className="inline-block size-5 rounded-2 border border-border/60"
				style={{ backgroundColor: color.hex }}
				title={color.oklch}
			/>
			<code className="font-mono text-[10px] text-muted-foreground">{color.hex}</code>
		</span>
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
 * 色板生成器章内容：选主色 → 实时推导品牌色阶、品牌角色、功能色与
 * 语义角色映射（明暗双域并列预览），核心配对附 WCAG 对比度审计。
 */
export function PaletteGenerator() {
	const [h, setH] = useState(222);
	const [c, setC] = useState(0.16);
	const palette = useMemo(() => generatePalette({ h, c }), [h, c]);

	return (
		<div className="mt-8">
			<div className="max-w-prose rounded-2xl border border-border/40 bg-card/50 p-6">
				<div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
					<label className="flex items-center gap-3 text-sm" htmlFor="seed-hue">
						色相
						<input
							className="w-44 accent-[--brand]"
							id="seed-hue"
							max={360}
							min={0}
							onChange={(event) => setH(Number(event.target.value))}
							type="range"
							value={h}
						/>
						<code className="font-mono text-xs text-muted-foreground">{h}°</code>
					</label>
					<label className="flex items-center gap-3 text-sm" htmlFor="seed-chroma">
						彩度
						<input
							className="w-32 accent-[--brand]"
							id="seed-chroma"
							max={0.3}
							min={0.06}
							onChange={(event) => setC(Number(event.target.value))}
							step={0.01}
							type="range"
							value={c}
						/>
						<code className="font-mono text-xs text-muted-foreground">
							{c.toFixed(2)}
						</code>
					</label>
					<div className="flex items-center gap-1.5">
						{HUE_PRESETS.map((preset) => (
							<button
								aria-label={preset.name}
								className={`size-6 rounded-full border transition-colors ${
									h === preset.h ? "border-foreground" : "border-border/60"
								}`}
								key={preset.h}
								onClick={() => setH(preset.h)}
								style={{ backgroundColor: `oklch(0.7 0.14 ${preset.h})` }}
								type="button"
							/>
						))}
					</div>
				</div>
				<p className="mt-3 text-sm leading-relaxed text-muted-foreground">
					换色 =
					换种子重跑算法：品牌色随色相与彩度全量推导，中性带取种子色相的低彩度晕染，
					功能色保持固定语义色相，明度按域适配。
				</p>
			</div>

			<h3 className="mt-10 text-lg font-bold">品牌色阶</h3>
			<div className="mt-3 flex overflow-hidden rounded-2xl border border-border/40">
				{palette.ramp.map((step) => (
					<button
						aria-label={`色阶 ${step.label} · ${step.hex}`}
						className="h-16 flex-1"
						key={step.label}
						style={{ backgroundColor: step.hex }}
						title={`${step.label} · ${step.hex}`}
						type="button"
					/>
				))}
			</div>
			<p className="mt-2 font-mono text-[10px] text-muted-foreground">
				{palette.ramp.map((step) => step.label).join(" · ")}
			</p>

			<h3 className="mt-10 text-lg font-bold">品牌角色</h3>
			<ul className="mt-3">
				{palette.brandRoles.map((role) => (
					<RoleRow key={role.role} role={role} />
				))}
			</ul>

			<h3 className="mt-10 text-lg font-bold">功能色</h3>
			<ul className="mt-3">
				{palette.functional.map((role) => (
					<RoleRow key={role.role} role={role} />
				))}
			</ul>

			<h3 className="mt-10 text-lg font-bold">中性带与语义角色</h3>
			<ul className="mt-3">
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

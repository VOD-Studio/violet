/**
 * PROTOTYPE（#645）：季节装饰，三层可分别开关。
 *
 * 插画：背景层视口角落的大幅插画，点缀位是首页寄语上方的小幅插画。
 * 飘落：背景层的粒子，每季运动方式不同。
 * 挂件：顶栏胶囊与页脚上沿的物候小物（属「组件」插槽，本轮只为样稿演示）。
 */
import type { SeasonKey } from "./directions";
import { CornerIllustration, VignetteIllustration } from "./illustrations";
import { PARTICLE_PROBES, useSeasonParticles } from "./particles";
import { type Layers, resolveDecoSeason, usePrototype } from "./store";

export function useDecoration(): { season: SeasonKey | null; layers: Layers } {
	const decoPref = usePrototype((state) => state.decoPref);
	const themePref = usePrototype((state) => state.themePref);
	const layers = usePrototype((state) => state.layers);
	if (!import.meta.env.DEV) return { season: null, layers };
	return { season: resolveDecoSeason(decoPref, themePref), layers };
}

function Particles({ season }: { season: SeasonKey }) {
	const { canvasRef, probeRef } = useSeasonParticles(season);
	return (
		<>
			<span ref={probeRef} aria-hidden="true" className="hidden">
				{PARTICLE_PROBES.map((color) => (
					<span key={color} style={{ color }} />
				))}
			</span>
			<canvas ref={canvasRef} className="absolute inset-0 size-full" />
		</>
	);
}

/** 背景层：挂在 SiteBackdrop 内，位于点阵之上、页面内容之下。 */
export function SeasonBackdrop() {
	const { season, layers } = useDecoration();
	if (!season) return null;
	return (
		<>
			{layers.illustration ? <CornerIllustration season={season} /> : null}
			{layers.particles ? <Particles key={season} season={season} /> : null}
		</>
	);
}

/** 点缀位：首页收尾寄语上方。 */
export function ClosingVignette() {
	const { season, layers } = useDecoration();
	if (!season || !layers.illustration) return null;
	return <VignetteIllustration season={season} />;
}

const SNOW = "light-dark(var(--neutral-1), var(--neutral-12))";

/** 挂件：放进带 relative 的胶囊里。 */
export function CapsuleOrnament({ variant = 0 }: { variant?: number }) {
	const { season, layers } = useDecoration();
	if (!season || !layers.ornaments) return null;
	switch (season) {
		case "winter":
			return (
				<svg
					aria-hidden="true"
					viewBox="0 0 100 10"
					preserveAspectRatio="none"
					className="pointer-events-none absolute -top-1.5 right-4 left-4 h-2.5"
				>
					<path
						d={
							variant % 2
								? "M0,10 C6,3 14,2 22,5 C32,0 44,1 54,4 C64,1 76,0 84,4 C92,2 97,5 100,10 Z"
								: "M0,10 C5,4 12,1 20,4 C30,1 40,3 50,2 C62,0 72,3 80,4 C90,1 96,4 100,10 Z"
						}
						vectorEffect="non-scaling-stroke"
						style={{ fill: SNOW, stroke: "var(--neutral-a7)", strokeWidth: 0.8 }}
					/>
				</svg>
			);
		case "spring":
			return (
				<svg
					aria-hidden="true"
					viewBox="0 0 24 16"
					className="pointer-events-none absolute -top-2 right-5 h-4 w-6"
				>
					<Petal x={8} y={9} rotate={-52} />
					<Petal x={18} y={6} rotate={30} small />
				</svg>
			);
		case "summer":
			return (
				<svg
					aria-hidden="true"
					viewBox="0 0 10 14"
					className={`pointer-events-none absolute -bottom-3 h-3.5 w-2.5 ${variant % 2 ? "right-8" : "left-7"}`}
				>
					<path
						d="M5,0 C7,4 9.5,6.5 9.5,9.2 A4.5,4.5 0 0 1 0.5,9.2 C0.5,6.5 3,4 5,0 Z"
						style={{
							fill: "var(--brand-a5)",
							stroke: "var(--brand-a8)",
							strokeWidth: 0.6,
						}}
					/>
					<circle cx={3.6} cy={9} r={1.1} style={{ fill: "var(--neutral-1)" }} />
				</svg>
			);
		case "autumn":
			return (
				<span
					aria-hidden="true"
					className={`pointer-events-none absolute -top-2.5 size-5 ${variant % 2 ? "-right-1.5 rotate-24" : "-left-1.5 -rotate-28"}`}
				>
					<MapleLeaf />
				</span>
			);
	}
}

function Petal({ x, y, rotate, small }: { x: number; y: number; rotate: number; small?: boolean }) {
	return (
		<ellipse
			cx={x}
			cy={y}
			rx={small ? 3 : 4.2}
			ry={small ? 4 : 5.6}
			transform={`rotate(${rotate} ${x} ${y})`}
			style={{
				fill: small ? "var(--brand-6)" : "var(--brand-5)",
				stroke: "var(--brand-7)",
				strokeWidth: 0.6,
			}}
		/>
	);
}

function MapleLeaf() {
	return (
		<svg aria-hidden="true" viewBox="-12 -12 24 24" className="size-full">
			<path
				d="M0,-10 L1.8,-5.2 L6.2,-7.2 L4.2,-2.4 L9.5,-0.5 L4,1.8 L5.2,6.2 L0.8,3.6 L0,9 L-0.8,3.6 L-5.2,6.2 L-4,1.8 L-9.5,-0.5 L-4.2,-2.4 L-6.2,-7.2 L-1.8,-5.2 Z"
				style={{ fill: "var(--brand-9)", stroke: "var(--brand-10)", strokeWidth: 0.6 }}
			/>
			<path
				d="M0,9 L0,-7 M0,0 L5,-4.5 M0,0 L-5,-4.5"
				style={{ fill: "none", stroke: "var(--brand-11)", strokeWidth: 0.7 }}
			/>
		</svg>
	);
}

const FALLEN: [number, number, number][] = [
	[4, -6, -20],
	[11, 2, 40],
	[19, -4, 110],
	[33, 0, -60],
	[46, -7, 15],
	[61, 1, 80],
	[70, -5, -35],
	[83, -1, 140],
	[94, -6, 60],
];

/** 挂件：页脚上沿的积雪、落花或落叶。 */
export function FooterOrnament() {
	const { season, layers } = useDecoration();
	if (!season || !layers.ornaments || season === "summer") return null;
	if (season === "winter") {
		return (
			<svg
				aria-hidden="true"
				viewBox="0 0 1200 24"
				preserveAspectRatio="none"
				className="pointer-events-none absolute inset-x-0 -top-4 h-6 w-full"
			>
				<path
					d="M0,24 L0,14 C60,6 120,10 190,8 C270,5 330,12 410,9 C500,5 560,11 650,8 C740,4 800,12 880,9 C960,6 1030,11 1100,8 C1150,6 1180,9 1200,10 L1200,24 Z"
					vectorEffect="non-scaling-stroke"
					style={{ fill: SNOW, stroke: "var(--neutral-a6)", strokeWidth: 0.8 }}
				/>
			</svg>
		);
	}
	return (
		<div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-0">
			{FALLEN.map(([x, y, rotate]) => (
				<span
					key={x}
					className="absolute size-4"
					style={{ left: `${x}%`, top: `${y}px`, transform: `rotate(${rotate}deg)` }}
				>
					{season === "spring" ? (
						<svg aria-hidden="true" viewBox="0 0 16 16" className="size-full">
							<Petal x={8} y={8} rotate={0} small={x % 2 === 0} />
						</svg>
					) : (
						<MapleLeaf />
					)}
				</span>
			))}
		</div>
	);
}

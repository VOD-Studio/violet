/**
 * 夏：荷塘。荷叶从叶心铺开，茎沿路径抽出，荷花与花苞相继绽放，花苞上停一只蜻蜓。
 */
import styles from "../../scene.module.css";
import { GrowReveal, RoughFilter, timing } from "./parts";

export interface LotusLeafProps {
	cx: number;
	cy: number;
	rx: number;
	ry: number;
	/** 叶面缺口的起始角（弧度） */
	notch: number;
	/** 入场延迟（秒） */
	time: number;
	prefix: string;
	/** 叶面渐变 id，同屏须唯一 */
	id: string;
}

/** 荷叶：带缺口的椭圆叶面与放射叶脉，从叶心向外铺开（裁剪揭开，不缩放）。 */
function LotusLeaf({ cx, cy, rx, ry, notch, time, prefix, id }: LotusLeafProps) {
	const points: [number, number][] = [];
	const gap = 0.07;
	for (let i = 0; i <= 72; i++) {
		const t = notch + gap + (i / 72) * (Math.PI * 2 - gap * 2);
		const wave = 1 + 0.03 * Math.sin(t * 11) + 0.015 * Math.sin(t * 23);
		points.push([cx + Math.cos(t) * rx * wave, cy + Math.sin(t) * ry * wave]);
	}
	const hub: [number, number] = [cx + rx * 0.05, cy - ry * 0.05];
	const outline = `M${hub[0].toFixed(1)},${hub[1].toFixed(1)} ${points.map(([x, y]) => `L${x.toFixed(1)},${y.toFixed(1)}`).join(" ")} Z`;
	return (
		<g
			className={styles.spread}
			style={{ ...timing(time), ["--hub-x" as string]: "52%", ["--hub-y" as string]: "47%" }}
		>
			<radialGradient
				id={id}
				cx={hub[0]}
				cy={hub[1]}
				r={Math.max(rx, ry)}
				gradientUnits="userSpaceOnUse"
				gradientTransform={`translate(${hub[0].toFixed(1)} ${hub[1].toFixed(1)}) scale(1 ${(ry / rx).toFixed(1)}) translate(${(-hub[0]).toFixed(1)} ${(-hub[1]).toFixed(1)})`}
			>
				<stop offset={0} style={{ stopColor: "var(--sprout)", stopOpacity: 0.55 }} />
				<stop offset={0.55} style={{ stopColor: "var(--brand-6)", stopOpacity: 0.6 }} />
				<stop offset={1} style={{ stopColor: "var(--brand-8)", stopOpacity: 0.75 }} />
			</radialGradient>
			<path d={outline} filter={`url(#${prefix}-rough)`} style={{ fill: `url(#${id})` }} />
			{Array.from({ length: 15 }, (_, i) => {
				const t = notch + gap * 2 + (i / 14) * (Math.PI * 2 - gap * 4);
				return (
					<path
						key={t}
						d={`M${hub[0].toFixed(1)},${hub[1].toFixed(1)} Q${(cx + Math.cos(t + 0.05) * rx * 0.5).toFixed(1)},${(cy + Math.sin(t + 0.05) * ry * 0.5).toFixed(1)} ${(cx + Math.cos(t) * rx * 0.93).toFixed(1)},${(cy + Math.sin(t) * ry * 0.93).toFixed(1)}`}
						style={{
							fill: "none",
							stroke: "var(--petal-light)",
							strokeWidth: 0.7,
							opacity: 0.55,
						}}
					/>
				);
			})}
		</g>
	);
}

/** 半开的荷花：后排四瓣、前排五瓣，瓣尖带一点粉。 */
export interface LotusFlowerProps {
	x: number;
	y: number;
	/** 花瓣长度 */
	size: number;
	/** 入场延迟（秒） */
	time: number;
	prefix: string;
}

function LotusFlower({ x, y, size, time, prefix }: LotusFlowerProps) {
	const back = [-52, -18, 18, 52];
	const front = [-66, -34, 0, 34, 66];
	const petal = (angle: number, k: number, scale: number, row: string) => (
		<g key={`${row}${angle}`} transform={`rotate(${angle})`}>
			<path
				d={`M0,0 C${(size * 0.34 * scale).toFixed(1)},${(-size * 0.3).toFixed(1)} ${(size * 0.26 * scale).toFixed(1)},${(-size * 0.8).toFixed(1)} 0,${(-size * scale).toFixed(1)} C${(-size * 0.26 * scale).toFixed(1)},${(-size * 0.8).toFixed(1)} ${(-size * 0.34 * scale).toFixed(1)},${(-size * 0.3).toFixed(1)} 0,0 Z`}
				className={styles.petal}
				style={{ ...timing(time + k * 0.09), fill: `url(#${prefix}-lotus)` }}
			/>
		</g>
	);
	return (
		<g transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`}>
			<g opacity={0.8}>{back.map((angle, k) => petal(angle, k, 0.92, "b"))}</g>
			{front.map((angle, k) => petal(angle, k + 3, 1, "f"))}
		</g>
	);
}

export interface DragonflyProps {
	x: number;
	y: number;
	rotate: number;
	/** 体型缩放，静态变换非动效 */
	scale?: number;
	/** 入场延迟（秒） */
	time: number;
}

/** 蜻蜓：常驻的只有翅膀轻颤。 */
function Dragonfly({ x, y, rotate, scale = 1, time }: DragonflyProps) {
	const wing = (d: string, key: string) => (
		<path
			key={key}
			d={d}
			className={styles.wing}
			style={{ fill: "var(--neutral-a3)", stroke: "var(--neutral-a6)", strokeWidth: 0.4 }}
		/>
	);
	return (
		<g
			transform={`translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${rotate}) scale(${scale})`}
		>
			<g className={styles.fade} style={timing(time, 1.2)}>
				{wing("M1,-4 C10,-12 30,-12 34,-7 C30,-2 12,-1 1,-3 Z", "a")}
				{wing("M1,-1 C10,-6 28,-3 31,2 C26,5 10,3 1,0 Z", "b")}
				<g transform="scale(-1 1)">
					{wing("M1,-4 C10,-12 30,-12 34,-7 C30,-2 12,-1 1,-3 Z", "c")}
					{wing("M1,-1 C10,-6 28,-3 31,2 C26,5 10,3 1,0 Z", "d")}
				</g>
				<path
					d="M-1.6,-8 C-2,0 -1.2,18 0,34 C1.2,18 2,0 1.6,-8 Z"
					style={{ fill: "var(--ink)" }}
				/>
				<circle cy={-9.5} r={2.6} style={{ fill: "var(--ink)" }} />
			</g>
		</g>
	);
}

/** 夏景：compact 用于点缀位的小幅插画。 */
export function SummerScene({ prefix, compact }: { prefix: string; compact?: boolean }) {
	const stem = (d: string, start: number, duration: number, key: string) => (
		<GrowReveal
			key={key}
			d={d}
			id={`${prefix}-${key}`}
			strokeWidth={8}
			start={start}
			duration={duration}
		>
			<path
				d={d}
				style={{
					fill: "none",
					stroke: "var(--sprout-deep)",
					strokeWidth: 2.4,
					strokeLinecap: "round",
				}}
			/>
		</GrowReveal>
	);
	return (
		<>
			<defs>
				<RoughFilter id={`${prefix}-rough`} scale={2} frequency={0.03} />
				<linearGradient id={`${prefix}-lotus`} x1="0" y1="1" x2="0" y2="0">
					<stop offset={0} style={{ stopColor: "var(--petal-light)" }} />
					<stop
						offset={0.65}
						style={{
							stopColor:
								"color-mix(in oklch, var(--category-6-4) 60%, var(--neutral-1))",
						}}
					/>
					<stop
						offset={1}
						style={{
							stopColor:
								"color-mix(in oklch, var(--category-6-7) 70%, var(--neutral-3))",
						}}
					/>
				</linearGradient>
				<linearGradient id={`${prefix}-bud`} x1="0" y1="1" x2="0" y2="0">
					<stop offset={0} style={{ stopColor: "var(--sprout)" }} />
					<stop
						offset={1}
						style={{
							stopColor:
								"color-mix(in oklch, var(--category-6-7) 65%, var(--neutral-4))",
						}}
					/>
				</linearGradient>
			</defs>
			{compact ? (
				<>
					<LotusLeaf
						cx={80}
						cy={100}
						rx={74}
						ry={15}
						notch={-1.4}
						time={0.1}
						prefix={prefix}
						id={`${prefix}-l1`}
					/>
					{stem("M128,100 Q122,74 132,52", 0.4, 0.6, "s1")}
					<LotusFlower x={132} y={54} size={24} time={0.9} prefix={prefix} />
					<Dragonfly x={186} y={42} rotate={64} scale={0.5} time={1.6} />
				</>
			) : (
				<>
					<ellipse
						cx={330}
						cy={352}
						rx={170}
						ry={30}
						className={styles.fade}
						style={{
							...timing(0.1, 1.6),
							fill: "none",
							stroke: "var(--water)",
							strokeWidth: 0.8,
						}}
					/>
					<ellipse
						cx={330}
						cy={352}
						rx={230}
						ry={44}
						className={styles.fade}
						style={{
							...timing(0.3, 1.6),
							fill: "none",
							stroke: "var(--water)",
							strokeWidth: 0.6,
							opacity: 0.7,
						}}
					/>
					{stem("M232,330 Q214,240 246,150", 0.6, 1.1, "s1")}
					{stem("M168,320 Q176,260 160,212", 0.9, 0.8, "s2")}
					<LotusLeaf
						cx={120}
						cy={326}
						rx={176}
						ry={66}
						notch={-1.25}
						time={0.2}
						prefix={prefix}
						id={`${prefix}-l1`}
					/>
					<g transform="translate(160 212) rotate(-8)">
						<path
							d="M0,0 C15,-12 13,-40 0,-56 C-13,-40 -15,-12 0,0 Z"
							className={styles.petal}
							style={{ ...timing(1.6), fill: `url(#${prefix}-bud)` }}
						/>
					</g>
					<LotusFlower x={246} y={152} size={58} time={1.5} prefix={prefix} />
					<LotusLeaf
						cx={344}
						cy={354}
						rx={116}
						ry={38}
						notch={-2.1}
						time={0.5}
						prefix={prefix}
						id={`${prefix}-l2`}
					/>
					<Dragonfly x={166} y={150} rotate={-12} scale={0.75} time={2.6} />
				</>
			)}
		</>
	);
}

/**
 * PROTOTYPE（#645）第三轮：四季插画。
 *
 * 程序生成、固定随机种子（SSR 与客户端一致），只用主题 token 混出的色板着色。
 * 入场时枝条沿主干生长，花叶在枝条经过后逐瓣展开；点缀位进入视口才开始。
 * 春：桃枝与嫩叶；夏：荷叶、荷花、花苞与蜻蜓；秋：满月前的桂枝；冬：积雪枯枝与红果。
 */
import { cn } from "cn";
import { type CSSProperties, useEffect, useId, useRef, useState } from "react";

import type { SeasonKey } from "./directions";
import styles from "./scene.module.css";

type Pt = [number, number];

function mulberry32(seed: number) {
	let a = seed;
	return () => {
		a |= 0;
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

const f = (n: number) => n.toFixed(1);
const deg = (radians: number) => (radians * 180) / Math.PI;
const timing = (delay: number, duration?: number) =>
	({
		"--delay": `${delay.toFixed(2)}s`,
		...(duration ? { "--duration": `${duration.toFixed(2)}s` } : {}),
	}) as CSSProperties;

// —— 枝条生长 ——

interface Limb {
	points: Pt[];
	widths: number[];
	depth: number;
	start: number;
	duration: number;
}

interface Spot {
	at: Pt;
	angle: number;
	width: number;
	time: number;
	depth: number;
}

interface Tree {
	limbs: Limb[];
	tips: Spot[];
	nodes: Spot[];
}

const GROW_SPEED = 320;

function growTree(
	seed: number,
	origin: Pt,
	angle: number,
	length: number,
	width: number,
	depth: number,
	children = 3,
	startAt = 0.2,
): Tree {
	const r = mulberry32(seed);
	const tree: Tree = { limbs: [], tips: [], nodes: [] };
	const grow = (
		start: Pt,
		startAngle: number,
		len: number,
		w: number,
		level: number,
		t0: number,
	) => {
		const steps = Math.max(4, Math.round(len / 14));
		const points: Pt[] = [start];
		const widths = [w];
		const angles = [startAngle];
		let a = startAngle;
		let [x, y] = start;
		const bias = (r() - 0.5) * 0.05;
		for (let i = 1; i <= steps; i++) {
			a += bias + (r() - 0.5) * 0.24;
			x += Math.cos(a) * (len / steps);
			y += Math.sin(a) * (len / steps);
			points.push([x, y]);
			widths.push(Math.max(0.8, w * (1 - (i / steps) * 0.82)));
			angles.push(a);
		}
		const duration = (len / GROW_SPEED) * (level === 0 ? 1 : 1.25);
		tree.limbs.push({ points, widths, depth: level, start: t0, duration });
		tree.tips.push({
			at: points[steps],
			angle: a,
			width: widths[steps],
			time: t0 + duration,
			depth: level,
		});
		for (let i = 2; i < steps; i++)
			tree.nodes.push({
				at: points[i],
				angle: angles[i],
				width: widths[i],
				time: t0 + duration * (i / steps) ** 0.8,
				depth: level,
			});
		if (level >= depth) return;
		const count = level === 0 ? children : Math.max(1, children - 1);
		for (let c = 0; c < count; c++) {
			const index = 1 + Math.floor(r() * (steps - 2));
			const side = c % 2 === 0 ? -1 : 1;
			grow(
				points[index],
				angles[index] + side * (0.42 + r() * 0.5),
				len * (0.3 + r() * 0.32) * (1 - (index / steps) * 0.4),
				widths[index] * 0.6,
				level + 1,
				t0 + duration * (index / steps) ** 0.8,
			);
		}
	};
	grow(origin, angle, length, width, 0, startAt);
	return tree;
}

function smoothThrough(points: Pt[]): string {
	let d = "";
	for (let i = 1; i < points.length - 1; i++) {
		const [x, y] = points[i];
		const [nx, ny] = points[i + 1];
		d += ` Q${f(x)},${f(y)} ${f((x + nx) / 2)},${f((y + ny) / 2)}`;
	}
	const last = points[points.length - 1];
	return `${d} L${f(last[0])},${f(last[1])}`;
}

const centerline = (points: Pt[]) =>
	`M${f(points[0][0])},${f(points[0][1])}${smoothThrough(points)}`;

function normalAt(points: Pt[], i: number): Pt {
	const [ax, ay] = points[Math.max(0, i - 1)];
	const [bx, by] = points[Math.min(points.length - 1, i + 1)];
	const length = Math.hypot(bx - ax, by - ay) || 1;
	return [-(by - ay) / length, (bx - ax) / length];
}

function taperedPath({ points, widths }: Pick<Limb, "points" | "widths">): string {
	const left: Pt[] = [];
	const right: Pt[] = [];
	points.forEach(([x, y], i) => {
		const [nx, ny] = normalAt(points, i);
		const half = widths[i] / 2;
		left.push([x + nx * half, y + ny * half]);
		right.push([x - nx * half, y - ny * half]);
	});
	const back = right.reverse();
	return `M${f(left[0][0])},${f(left[0][1])}${smoothThrough(left)} L${f(back[0][0])},${f(back[0][1])}${smoothThrough(back)} Z`;
}

/** 收细的枝条，用沿主干推进的描边遮罩揭开。 */
function GrowingLimb({
	limb,
	id,
	fill,
	filter,
}: {
	limb: Limb;
	id: string;
	fill: string;
	filter?: string;
}) {
	return (
		<g>
			<mask id={id}>
				<path
					d={centerline(limb.points)}
					pathLength={1}
					className={styles.grow}
					style={{
						...timing(limb.start, limb.duration),
						fill: "none",
						stroke: "#fff",
						strokeWidth: limb.widths[0] * 1.6 + 8,
						strokeDasharray: "1 1",
					}}
				/>
			</mask>
			<path d={taperedPath(limb)} mask={`url(#${id})`} filter={filter} style={{ fill }} />
		</g>
	);
}

/** 有机边缘：轻微扰动轮廓，去掉矢量图的机械感。 */
function RoughFilter({
	id,
	scale = 2.4,
	frequency = 0.04,
}: {
	id: string;
	scale?: number;
	frequency?: number;
}) {
	return (
		<filter id={id} x="-10%" y="-10%" width="120%" height="120%">
			<feTurbulence
				type="fractalNoise"
				baseFrequency={frequency}
				numOctaves={2}
				seed={7}
				result="noise"
			/>
			<feDisplacementMap
				in="SourceGraphic"
				in2="noise"
				scale={scale}
				xChannelSelector="R"
				yChannelSelector="G"
			/>
		</filter>
	);
}

function useSafeId() {
	return useId().replace(/[^a-zA-Z0-9_-]/g, "");
}

// —— 花瓣与叶片 ——

/** 桃花瓣：宽圆、瓣尖微凹，从原点向上。 */
function petalPath(r: number) {
	return `M0,0 C${f(-0.42 * r)},${f(-0.14 * r)} ${f(-0.58 * r)},${f(-0.66 * r)} ${f(-0.34 * r)},${f(-0.94 * r)} C${f(-0.2 * r)},${f(-1.06 * r)} ${f(-0.05 * r)},${f(-1.02 * r)} 0,${f(-0.96 * r)} C${f(0.05 * r)},${f(-1.02 * r)} ${f(0.2 * r)},${f(-1.06 * r)} ${f(0.34 * r)},${f(-0.94 * r)} C${f(0.58 * r)},${f(-0.66 * r)} ${f(0.42 * r)},${f(-0.14 * r)} 0,0 Z`;
}

/** 披针形叶片：叶柄在原点，向上。 */
function leafPath(length: number, width: number) {
	return `M0,0 C${f(width)},${f(-length * 0.25)} ${f(width * 0.9)},${f(-length * 0.7)} 0,${f(-length)} C${f(-width * 0.9)},${f(-length * 0.7)} ${f(-width)},${f(-length * 0.25)} 0,0 Z`;
}

function PetalGradients({ prefix }: { prefix: string }) {
	const variants: [number, number][] = [
		[0.22, 0.6],
		[0.3, 0.75],
		[0.14, 0.5],
	];
	return (
		<>
			{variants.map(([deep, mid], i) => (
				<radialGradient key={deep} id={`${prefix}-petal-${i}`} cx="0.5" cy="1" r="1.1">
					<stop offset={0} style={{ stopColor: "var(--petal-deep)" }} />
					<stop offset={deep} style={{ stopColor: "var(--petal-mid)" }} />
					<stop offset={mid} style={{ stopColor: "var(--petal-light)" }} />
					<stop
						offset={1}
						style={{ stopColor: "var(--petal-light)", stopOpacity: 0.85 }}
					/>
				</radialGradient>
			))}
			<linearGradient id={`${prefix}-sprout`} x1="0" y1="1" x2="0" y2="0">
				<stop offset={0} style={{ stopColor: "var(--sprout-deep)" }} />
				<stop offset={1} style={{ stopColor: "var(--sprout)" }} />
			</linearGradient>
		</>
	);
}

function Blossom({
	x,
	y,
	r,
	rotate,
	time,
	variant,
	prefix,
	open = 5,
}: {
	x: number;
	y: number;
	r: number;
	rotate: number;
	time: number;
	variant: number;
	prefix: string;
	open?: number;
}) {
	const angles = open === 5 ? [0, 72, 144, 216, 288] : [-58, 0, 58];
	return (
		<g transform={`translate(${f(x)} ${f(y)}) rotate(${f(rotate)})`}>
			{angles.map((angle, k) => (
				<g key={angle} transform={`rotate(${angle})`}>
					<path
						d={petalPath(r)}
						className={styles.petal}
						style={{
							...timing(time + k * 0.08),
							fill: `url(#${prefix}-petal-${variant})`,
						}}
					/>
				</g>
			))}
			{open === 5 ? (
				<g className={styles.fade} style={timing(time + 0.45, 0.6)}>
					<circle r={r * 0.17} style={{ fill: "var(--petal-deep)" }} />
					{Array.from({ length: 11 }, (_, k) => {
						const a = (k / 11) * Math.PI * 2 + 0.2;
						const len = r * (0.36 + ((k * 7) % 5) * 0.03);
						return (
							<g key={a}>
								<line
									x1={0}
									y1={0}
									x2={Math.cos(a) * len}
									y2={Math.sin(a) * len}
									style={{
										stroke: "var(--petal-deep)",
										strokeWidth: 0.45,
										opacity: 0.7,
									}}
								/>
								<circle
									cx={Math.cos(a) * len}
									cy={Math.sin(a) * len}
									r={0.85}
									style={{ fill: "var(--anther)" }}
								/>
							</g>
						);
					})}
				</g>
			) : null}
		</g>
	);
}

function Bud({
	x,
	y,
	r,
	rotate,
	time,
	prefix,
}: {
	x: number;
	y: number;
	r: number;
	rotate: number;
	time: number;
	prefix: string;
}) {
	return (
		<g transform={`translate(${f(x)} ${f(y)}) rotate(${f(rotate)})`}>
			<path
				d={leafPath(r * 1.6, r * 0.42)}
				className={styles.leaf}
				style={{
					...timing(time),
					fill: "var(--sprout-deep)",
					["--fold" as string]: "0deg",
				}}
			/>
			<g transform="scale(0.62 1)">
				<path
					d={petalPath(r)}
					className={styles.petal}
					style={{ ...timing(time + 0.1), fill: `url(#${prefix}-petal-1)` }}
				/>
			</g>
		</g>
	);
}

function SproutLeaf({
	x,
	y,
	length,
	rotate,
	time,
	prefix,
	fold,
}: {
	x: number;
	y: number;
	length: number;
	rotate: number;
	time: number;
	prefix: string;
	fold: number;
}) {
	return (
		<g transform={`translate(${f(x)} ${f(y)}) rotate(${f(rotate)})`}>
			<path
				d={leafPath(length, length * 0.2)}
				className={styles.leaf}
				style={{
					...timing(time),
					fill: `url(#${prefix}-sprout)`,
					["--fold" as string]: `${fold}deg`,
				}}
			/>
		</g>
	);
}

// —— 春 ——

function PeachBranch({
	seed,
	origin,
	angle,
	length,
	width,
	depth,
	prefix,
	gradients,
	far = false,
}: {
	seed: number;
	origin: Pt;
	angle: number;
	length: number;
	width: number;
	depth: number;
	prefix: string;
	gradients: string;
	far?: boolean;
}) {
	const tree = growTree(seed, origin, angle, length, width, depth, 3, far ? 0.5 : 0.2);
	const r = mulberry32(seed + 7);
	const flowers = [
		...tree.tips.map((tip) => ({ ...tip, kind: r() < 0.4 ? "bud" : "bloom" })),
		...tree.nodes
			.filter((node) => node.width < width * 0.6 && r() < (far ? 0.2 : 0.3))
			.map((node) => ({ ...node, kind: r() < 0.22 ? "bud" : r() < 0.2 ? "leaf" : "bloom" })),
	];
	return (
		<g>
			{tree.limbs.map((limb, i) => (
				<GrowingLimb
					key={`${prefix}-limb-${limb.start}-${i}`}
					limb={limb}
					id={`${prefix}-limb-${i}`}
					fill="var(--ink)"
					filter={`url(#${gradients}-rough)`}
				/>
			))}
			{flowers.map((spot, i) => {
				const side = i % 2 ? 1 : -1;
				const baseRotate = deg(spot.angle) + 90;
				const key = `${spot.at[0]}-${spot.at[1]}`;
				if (spot.kind === "leaf")
					return (
						<g key={key}>
							<SproutLeaf
								x={spot.at[0]}
								y={spot.at[1]}
								length={20 + r() * 10}
								rotate={baseRotate + side * 55}
								time={spot.time}
								prefix={gradients}
								fold={-side * 40}
							/>
							<SproutLeaf
								x={spot.at[0]}
								y={spot.at[1]}
								length={16 + r() * 8}
								rotate={baseRotate - side * 35}
								time={spot.time + 0.12}
								prefix={gradients}
								fold={side * 40}
							/>
						</g>
					);
				if (spot.kind === "bud")
					return (
						<Bud
							key={key}
							x={spot.at[0]}
							y={spot.at[1]}
							r={6 + r() * 3}
							rotate={baseRotate + side * (20 + r() * 30)}
							time={spot.time}
							prefix={gradients}
						/>
					);
				return (
					<Blossom
						key={key}
						x={spot.at[0] + (r() - 0.5) * 5}
						y={spot.at[1] + (r() - 0.5) * 5}
						r={10 + r() * 6}
						rotate={r() * 72}
						time={spot.time}
						variant={i % 3}
						prefix={gradients}
						open={r() < 0.25 ? 3 : 5}
					/>
				);
			})}
		</g>
	);
}

function SpringScene({ prefix, compact }: { prefix: string; compact?: boolean }) {
	return (
		<>
			<defs>
				<PetalGradients prefix={prefix} />
				<RoughFilter id={`${prefix}-rough`} />
				<filter id={`${prefix}-far`}>
					<feGaussianBlur stdDeviation={1.6} />
				</filter>
			</defs>
			{compact ? (
				<PeachBranch
					seed={31}
					origin={[0, 70]}
					angle={-0.16}
					length={230}
					width={4.5}
					depth={1}
					prefix={prefix}
					gradients={prefix}
				/>
			) : (
				<>
					<g filter={`url(#${prefix}-far)`} opacity={0.45}>
						<PeachBranch
							seed={57}
							origin={[660, 190]}
							angle={Math.PI - 0.22}
							length={320}
							width={6}
							depth={1}
							prefix={`${prefix}f`}
							gradients={prefix}
							far
						/>
					</g>
					<PeachBranch
						seed={11}
						origin={[660, 28]}
						angle={Math.PI - 0.52}
						length={480}
						width={12}
						depth={2}
						prefix={prefix}
						gradients={prefix}
					/>
				</>
			)}
		</>
	);
}

// —— 夏 ——

function LotusLeaf({
	cx,
	cy,
	rx,
	ry,
	notch,
	time,
	prefix,
	id,
}: {
	cx: number;
	cy: number;
	rx: number;
	ry: number;
	notch: number;
	time: number;
	prefix: string;
	id: string;
}) {
	const points: Pt[] = [];
	const gap = 0.07;
	for (let i = 0; i <= 72; i++) {
		const t = notch + gap + (i / 72) * (Math.PI * 2 - gap * 2);
		const wave = 1 + 0.03 * Math.sin(t * 11) + 0.015 * Math.sin(t * 23);
		points.push([cx + Math.cos(t) * rx * wave, cy + Math.sin(t) * ry * wave]);
	}
	const hub: Pt = [cx + rx * 0.05, cy - ry * 0.05];
	const outline = `M${f(hub[0])},${f(hub[1])} ${points.map(([x, y]) => `L${f(x)},${f(y)}`).join(" ")} Z`;
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
				gradientTransform={`translate(${f(hub[0])} ${f(hub[1])}) scale(1 ${f(ry / rx)}) translate(${f(-hub[0])} ${f(-hub[1])})`}
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
						d={`M${f(hub[0])},${f(hub[1])} Q${f(cx + Math.cos(t + 0.05) * rx * 0.5)},${f(cy + Math.sin(t + 0.05) * ry * 0.5)} ${f(cx + Math.cos(t) * rx * 0.93)},${f(cy + Math.sin(t) * ry * 0.93)}`}
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
function LotusFlower({
	x,
	y,
	size,
	time,
	prefix,
}: {
	x: number;
	y: number;
	size: number;
	time: number;
	prefix: string;
}) {
	const back = [-52, -18, 18, 52];
	const front = [-66, -34, 0, 34, 66];
	const petal = (angle: number, k: number, scale: number, row: string) => (
		<g key={`${row}${angle}`} transform={`rotate(${angle})`}>
			<path
				d={`M0,0 C${f(size * 0.34 * scale)},${f(-size * 0.3)} ${f(size * 0.26 * scale)},${f(-size * 0.8)} 0,${f(-size * scale)} C${f(-size * 0.26 * scale)},${f(-size * 0.8)} ${f(-size * 0.34 * scale)},${f(-size * 0.3)} 0,0 Z`}
				className={styles.petal}
				style={{ ...timing(time + k * 0.09), fill: `url(#${prefix}-lotus)` }}
			/>
		</g>
	);
	return (
		<g transform={`translate(${f(x)} ${f(y)})`}>
			<g opacity={0.8}>{back.map((angle, k) => petal(angle, k, 0.92, "b"))}</g>
			{front.map((angle, k) => petal(angle, k + 3, 1, "f"))}
		</g>
	);
}

function Dragonfly({
	x,
	y,
	rotate,
	scale = 1,
	time,
}: {
	x: number;
	y: number;
	rotate: number;
	scale?: number;
	time: number;
}) {
	const wing = (d: string, key: string) => (
		<path
			key={key}
			d={d}
			className={styles.wing}
			style={{ fill: "var(--neutral-a3)", stroke: "var(--neutral-a6)", strokeWidth: 0.4 }}
		/>
	);
	return (
		<g transform={`translate(${f(x)} ${f(y)}) rotate(${rotate}) scale(${scale})`}>
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

function SummerScene({ prefix, compact }: { prefix: string; compact?: boolean }) {
	const stem = (d: string, start: number, duration: number, key: string) => (
		<g key={key}>
			<mask id={`${prefix}-${key}`}>
				<path
					d={d}
					pathLength={1}
					className={styles.grow}
					style={{
						...timing(start, duration),
						fill: "none",
						stroke: "#fff",
						strokeWidth: 8,
						strokeDasharray: "1 1",
					}}
				/>
			</mask>
			<path
				d={d}
				mask={`url(#${prefix}-${key})`}
				style={{
					fill: "none",
					stroke: "var(--sprout-deep)",
					strokeWidth: 2.4,
					strokeLinecap: "round",
				}}
			/>
		</g>
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

// —— 秋 ——

function Floret({ x, y, r, time }: { x: number; y: number; r: number; time: number }) {
	return (
		<g transform={`translate(${f(x)} ${f(y)}) rotate(45)`}>
			<g className={styles.fade} style={timing(time, 0.5)}>
				{[0, 90, 180, 270].map((angle) => (
					<ellipse
						key={angle}
						cy={-r * 0.6}
						rx={r * 0.5}
						ry={r * 0.62}
						transform={`rotate(${angle})`}
						style={{ fill: "color-mix(in oklch, var(--brand-9) 75%, var(--anther))" }}
					/>
				))}
				<circle r={r * 0.25} style={{ fill: "var(--brand-11)", opacity: 0.6 }} />
			</g>
		</g>
	);
}

function OsmanthusSprig({
	seed,
	origin,
	angle,
	length,
	width,
	prefix,
	scale = 1,
}: {
	seed: number;
	origin: Pt;
	angle: number;
	length: number;
	width: number;
	prefix: string;
	scale?: number;
}) {
	const tree = growTree(seed, origin, angle, length, width, 1, 2, 0.6);
	const r = mulberry32(seed + 3);
	return (
		<g>
			{tree.limbs.map((limb, i) => (
				<GrowingLimb
					key={`${limb.start}-${i}`}
					limb={limb}
					id={`${prefix}-limb-${i}`}
					fill="var(--ink)"
					filter={`url(#${prefix}-rough)`}
				/>
			))}
			{tree.nodes
				.filter((_, i) => i % 2 === 0)
				.map((node, i) => {
					const base = deg(node.angle) + 90;
					const side = i % 2 === 0 ? 1 : -1;
					const length = (32 + r() * 18) * scale;
					return (
						<g key={`${node.at[0]}-${node.at[1]}`}>
							<g
								transform={`translate(${f(node.at[0])} ${f(node.at[1])}) rotate(${f(base + side * (46 + r() * 16))})`}
							>
								<path
									d={leafPath(length, length * 0.22)}
									className={styles.leaf}
									style={{
										...timing(node.time + 0.05),
										fill: `url(#${prefix}-osleaf)`,
										["--fold" as string]: `${-side * 35}deg`,
									}}
								/>
								<path
									d={`M0,0 L0,${f(-length * 0.9)}`}
									className={styles.fade}
									style={{
										...timing(node.time + 0.4),
										stroke: "var(--petal-light)",
										strokeWidth: 0.5,
										opacity: 0.5,
									}}
								/>
							</g>
							{r() < 0.75
								? Array.from({ length: 4 + Math.floor(r() * 5) }, (_, k) => (
										<Floret
											key={k}
											x={node.at[0] + (r() - 0.5) * 16 * scale}
											y={node.at[1] + (r() - 0.5) * 12 * scale}
											r={(2.4 + r() * 1.2) * scale}
											time={node.time + 0.5 + k * 0.07}
										/>
									))
								: null}
						</g>
					);
				})}
			{tree.tips.map((tip) => (
				<g
					key={`${tip.at[0]}-${tip.at[1]}`}
					transform={`translate(${f(tip.at[0])} ${f(tip.at[1])}) rotate(${f(deg(tip.angle) + 90)})`}
				>
					<path
						d={leafPath(28 * scale, 6 * scale)}
						className={styles.leaf}
						style={{ ...timing(tip.time), fill: `url(#${prefix}-osleaf)` }}
					/>
				</g>
			))}
		</g>
	);
}

function AutumnScene({ prefix, compact }: { prefix: string; compact?: boolean }) {
	return (
		<>
			<defs>
				<RoughFilter id={`${prefix}-rough`} scale={1.8} />
				<filter id={`${prefix}-halo`} x="-50%" y="-50%" width="200%" height="200%">
					<feGaussianBlur stdDeviation={18} />
				</filter>
				<radialGradient id={`${prefix}-moon`} cx="0.42" cy="0.4" r="0.7">
					<stop offset={0} style={{ stopColor: "var(--moon)" }} />
					<stop offset={1} style={{ stopColor: "var(--moon)", stopOpacity: 0.78 }} />
				</radialGradient>
				<linearGradient id={`${prefix}-osleaf`} x1="0" y1="1" x2="0" y2="0">
					<stop offset={0} style={{ stopColor: "var(--ink)" }} />
					<stop
						offset={1}
						style={{
							stopColor: "color-mix(in oklch, var(--sprout-deep) 55%, var(--ink))",
						}}
					/>
				</linearGradient>
			</defs>
			{compact ? (
				<>
					<circle
						cx={110}
						cy={50}
						r={40}
						className={styles.fade}
						style={{ ...timing(0, 1.2), fill: `url(#${prefix}-moon)` }}
					/>
					<OsmanthusSprig
						seed={9}
						origin={[220, 78]}
						angle={Math.PI + 0.2}
						length={150}
						width={2.4}
						prefix={prefix}
						scale={0.6}
					/>
				</>
			) : (
				<>
					<circle
						cx={390}
						cy={150}
						r={150}
						filter={`url(#${prefix}-halo)`}
						className={styles.fade}
						style={{ ...timing(0, 2), fill: "var(--moon-halo)" }}
					/>
					<circle
						cx={390}
						cy={150}
						r={104}
						className={styles.fade}
						style={{ ...timing(0.1, 1.6), fill: `url(#${prefix}-moon)` }}
					/>
					<OsmanthusSprig
						seed={5}
						origin={[640, 300]}
						angle={Math.PI + 0.42}
						length={350}
						width={5}
						prefix={prefix}
					/>
				</>
			)}
		</>
	);
}

// —— 冬 ——

function snowPath({ points, widths }: Limb, seed: number): string | null {
	const r = mulberry32(seed);
	const top: Pt[] = [];
	const bottom: Pt[] = [];
	let total = 0;
	points.forEach(([x, y], i) => {
		const [nx] = normalAt(points, i);
		const flat = Math.abs(nx) < 0.5 ? 1 - Math.abs(nx) * 1.7 : 0;
		const thick = flat * (2 + r() * 3 + widths[i] * 0.3);
		total += thick;
		top.push([x, y - widths[i] / 2 - thick]);
		bottom.push([x, y - widths[i] * 0.1]);
	});
	if (total < 5) return null;
	const back = bottom.reverse();
	return `M${f(top[0][0])},${f(top[0][1])}${smoothThrough(top)} L${f(back[0][0])},${f(back[0][1])}${smoothThrough(back)} Z`;
}

function SnowyBranch({
	seed,
	origin,
	angle,
	length,
	width,
	prefix,
	berries = true,
}: {
	seed: number;
	origin: Pt;
	angle: number;
	length: number;
	width: number;
	prefix: string;
	berries?: boolean;
}) {
	const tree = growTree(seed, origin, angle, length, width, 2, 3);
	const r = mulberry32(seed + 5);
	const last = Math.max(...tree.limbs.map((limb) => limb.start + limb.duration));
	const berrySpots = berries ? tree.tips.filter(() => r() < 0.35).slice(0, 3) : [];
	return (
		<g>
			{tree.limbs.map((limb, i) => (
				<GrowingLimb
					key={`${limb.start}-${i}`}
					limb={limb}
					id={`${prefix}-limb-${i}`}
					fill="var(--ink)"
					filter={`url(#${prefix}-rough)`}
				/>
			))}
			{berrySpots.map((spot) => (
				<g
					key={`${spot.at[0]}-${spot.at[1]}`}
					className={styles.fade}
					style={timing(spot.time + 0.2, 0.6)}
				>
					{[0, 1, 2].map((k) => (
						<circle
							key={k}
							cx={spot.at[0] + Math.cos(spot.angle + k * 2.1) * 4}
							cy={spot.at[1] + Math.sin(spot.angle + k * 2.1) * 4 + 2}
							r={3 - k * 0.4}
							style={{
								fill: "color-mix(in oklch, var(--category-6-9) 85%, var(--neutral-9))",
							}}
						/>
					))}
				</g>
			))}
			{tree.limbs.map((limb, i) => {
				const d = snowPath(limb, seed + i);
				return d ? (
					<path
						key={`s${limb.start}-${i}`}
						d={d}
						className={styles.settle}
						filter={`url(#${prefix}-snowedge)`}
						style={{
							...timing(last + 0.1 + i * 0.06),
							fill: `url(#${prefix}-snow)`,
							stroke: "var(--ink-soft)",
							strokeWidth: 0.4,
						}}
					/>
				) : null;
			})}
		</g>
	);
}

function WinterScene({ prefix, compact }: { prefix: string; compact?: boolean }) {
	return (
		<>
			<defs>
				<RoughFilter id={`${prefix}-rough`} />
				<RoughFilter id={`${prefix}-snowedge`} scale={2.2} frequency={0.09} />
				<linearGradient id={`${prefix}-snow`} x1="0" y1="0" x2="0" y2="1">
					<stop offset={0} style={{ stopColor: "var(--snow)" }} />
					<stop offset={1} style={{ stopColor: "var(--snow-shade)" }} />
				</linearGradient>
			</defs>
			{compact ? (
				<SnowyBranch
					seed={41}
					origin={[6, 48]}
					angle={-0.05}
					length={210}
					width={5}
					prefix={prefix}
					berries={false}
				/>
			) : (
				<SnowyBranch
					seed={23}
					origin={[-20, 150]}
					angle={0.1}
					length={520}
					width={13}
					prefix={prefix}
				/>
			)}
		</>
	);
}

// —— 组合 ——

function Scene({
	viewBox,
	className,
	playOnView,
	children,
}: {
	viewBox: string;
	className: string;
	playOnView?: boolean;
	children: (prefix: string) => React.ReactNode;
}) {
	const prefix = useSafeId();
	const ref = useRef<SVGSVGElement>(null);
	const [play, setPlay] = useState(!playOnView);
	useEffect(() => {
		const element = ref.current;
		if (!playOnView || !element) return undefined;
		const observer = new IntersectionObserver(
			([entry]) => {
				if (entry.isIntersecting) {
					setPlay(true);
					observer.disconnect();
				}
			},
			{ threshold: 0.6 },
		);
		observer.observe(element);
		return () => observer.disconnect();
	}, [playOnView]);
	return (
		<svg
			ref={ref}
			aria-hidden="true"
			viewBox={viewBox}
			data-play={play ? "" : undefined}
			className={cn(styles.scene, className)}
		>
			{children(prefix)}
		</svg>
	);
}

const CORNER = {
	spring: {
		viewBox: "0 0 640 470",
		className:
			"top-0 right-0 w-[min(44vw,640px)] [mask-image:radial-gradient(circle_at_100%_0%,#000_60%,transparent_95%)]",
	},
	summer: {
		viewBox: "0 0 600 380",
		className:
			"bottom-0 left-0 w-[min(44vw,600px)] [mask-image:radial-gradient(circle_at_0%_100%,#000_62%,transparent_95%)]",
	},
	autumn: {
		viewBox: "0 0 640 470",
		className:
			"top-0 right-0 w-[min(44vw,640px)] [mask-image:radial-gradient(circle_at_100%_0%,#000_62%,transparent_96%)]",
	},
	winter: {
		viewBox: "0 0 600 430",
		className:
			"top-0 left-0 w-[min(44vw,600px)] [mask-image:radial-gradient(circle_at_0%_0%,#000_60%,transparent_95%)]",
	},
} as const;

const SCENES = {
	spring: SpringScene,
	summer: SummerScene,
	autumn: AutumnScene,
	winter: WinterScene,
};

/** 背景层：视口角落的大幅插画，挂载即生长。 */
export function CornerIllustration({ season }: { season: SeasonKey }) {
	const SceneContent = SCENES[season];
	return (
		<Scene key={season} viewBox={CORNER[season].viewBox} className={CORNER[season].className}>
			{(prefix) => <SceneContent prefix={prefix} />}
		</Scene>
	);
}

/** 点缀位：首页寄语上方的小幅插画，进入视口才生长。 */
export function VignetteIllustration({ season }: { season: SeasonKey }) {
	const SceneContent = SCENES[season];
	return (
		<Scene
			key={season}
			viewBox="0 0 230 110"
			className="relative! mx-auto mb-6 block h-22"
			playOnView
		>
			{(prefix) => <SceneContent prefix={prefix} compact />}
		</Scene>
	);
}

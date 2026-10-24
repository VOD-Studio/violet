/**
 * PROTOTYPE（#645）：四季插画，程序生成、固定随机种子（SSR 与客户端一致），只用主题 token 着色。
 *
 * 春：角落一枝桃花；夏：荷叶、花苞与蜻蜓；秋：满月前的桂枝剪影；冬：积雪的枯枝。
 */
import type { SeasonKey } from "./directions";

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

interface Limb {
	points: Pt[];
	widths: number[];
	depth: number;
}

interface Tree {
	limbs: Limb[];
	tips: { at: Pt; angle: number; width: number }[];
	nodes: { at: Pt; angle: number; width: number }[];
}

/** 递归生长枝条：每段轻微弯折并逐渐收细，沿途分叉。 */
function growTree(
	seed: number,
	origin: Pt,
	angle: number,
	length: number,
	width: number,
	depth: number,
	children = 3,
): Tree {
	const r = mulberry32(seed);
	const tree: Tree = { limbs: [], tips: [], nodes: [] };
	const grow = (start: Pt, startAngle: number, len: number, w: number, level: number) => {
		const steps = Math.max(4, Math.round(len / 16));
		const points: Pt[] = [start];
		const widths = [w];
		const angles = [startAngle];
		let a = startAngle;
		let [x, y] = start;
		const bias = (r() - 0.5) * 0.06;
		for (let i = 1; i <= steps; i++) {
			a += bias + (r() - 0.5) * 0.28;
			x += Math.cos(a) * (len / steps);
			y += Math.sin(a) * (len / steps);
			points.push([x, y]);
			widths.push(w * (1 - (i / steps) * 0.78));
			angles.push(a);
		}
		tree.limbs.push({ points, widths, depth: level });
		tree.tips.push({ at: points[steps], angle: a, width: widths[steps] });
		for (let i = 2; i < steps; i++)
			tree.nodes.push({ at: points[i], angle: angles[i], width: widths[i] });
		if (level >= depth) return;
		const count = level === 0 ? children : Math.max(1, children - 1);
		for (let c = 0; c < count; c++) {
			const index = 1 + Math.floor(r() * (steps - 2));
			const side = c % 2 === 0 ? -1 : 1;
			grow(
				points[index],
				angles[index] + side * (0.45 + r() * 0.5),
				len * (0.32 + r() * 0.3) * (1 - (index / steps) * 0.4),
				widths[index] * 0.62,
				level + 1,
			);
		}
	};
	grow(origin, angle, length, width, 0);
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

function normalAt(points: Pt[], i: number): Pt {
	const [ax, ay] = points[Math.max(0, i - 1)];
	const [bx, by] = points[Math.min(points.length - 1, i + 1)];
	const length = Math.hypot(bx - ax, by - ay) || 1;
	return [-(by - ay) / length, (bx - ax) / length];
}

/** 枝条画成收细的实心形状，比描边更像毛笔枝干。 */
function taperedPath({ points, widths }: Limb): string {
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

/** 积雪：沿枝条上表面堆一条起伏的雪，越平的枝段越厚。 */
function snowPath({ points, widths }: Limb, seed: number): string | null {
	const r = mulberry32(seed);
	const top: Pt[] = [];
	const bottom: Pt[] = [];
	let total = 0;
	points.forEach(([x, y], i) => {
		const [nx, ny] = normalAt(points, i);
		const flat =
			Math.max(0, Math.abs(nx) < 0.5 ? 1 - Math.abs(nx) * 1.6 : 0) * (ny < 0 ? 1 : 1);
		const thick = flat * (2.2 + r() * 3.2 + widths[i] * 0.25);
		total += thick;
		top.push([x, y - widths[i] / 2 - thick]);
		bottom.push([x, y - widths[i] * 0.15]);
	});
	if (total < 4) return null;
	const back = bottom.reverse();
	return `M${f(top[0][0])},${f(top[0][1])}${smoothThrough(top)} L${f(back[0][0])},${f(back[0][1])}${smoothThrough(back)} Z`;
}

const BRANCH =
	"light-dark(color-mix(in oklch, var(--neutral-12) 78%, transparent), var(--neutral-8))";
const SNOW = "light-dark(var(--neutral-1), var(--neutral-12))";

// —— 春：桃花 ——

export function Blossom({ x, y, r, rotate }: { x: number; y: number; r: number; rotate: number }) {
	return (
		<g transform={`translate(${f(x)} ${f(y)}) rotate(${f(rotate)})`}>
			{[0, 72, 144, 216, 288].map((angle) => (
				<ellipse
					key={angle}
					cx={0}
					cy={-r * 0.55}
					rx={r * 0.44}
					ry={r * 0.56}
					transform={`rotate(${angle})`}
					style={{ fill: "var(--brand-5)", stroke: "var(--brand-7)", strokeWidth: 0.6 }}
				/>
			))}
			<circle r={r * 0.24} style={{ fill: "var(--brand-8)" }} />
			{[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
				<g key={angle} transform={`rotate(${angle})`}>
					<line
						y1={-r * 0.18}
						y2={-r * 0.46}
						style={{ stroke: "var(--brand-10)", strokeWidth: 0.6 }}
					/>
					<circle cy={-r * 0.48} r={0.9} style={{ fill: "var(--brand-11)" }} />
				</g>
			))}
		</g>
	);
}

function Bud({ x, y, r, rotate }: { x: number; y: number; r: number; rotate: number }) {
	return (
		<ellipse
			cx={x}
			cy={y}
			rx={r * 0.65}
			ry={r}
			transform={`rotate(${f(rotate)} ${f(x)} ${f(y)})`}
			style={{ fill: "var(--brand-7)", stroke: "var(--brand-9)", strokeWidth: 0.6 }}
		/>
	);
}

function SpringBranch({
	seed,
	origin,
	angle,
	length,
	width,
	depth,
}: {
	seed: number;
	origin: Pt;
	angle: number;
	length: number;
	width: number;
	depth: number;
}) {
	const tree = growTree(seed, origin, angle, length, width, depth);
	const r = mulberry32(seed + 7);
	const flowers = [
		...tree.tips.map((tip) => ({ ...tip, bud: r() < 0.35 })),
		...tree.nodes
			.filter((node) => node.width < width * 0.55 && r() < 0.32)
			.map((node) => ({ ...node, bud: r() < 0.25 })),
	];
	return (
		<g>
			{tree.limbs.map((limb, i) => (
				<path key={i} d={taperedPath(limb)} style={{ fill: BRANCH }} />
			))}
			{flowers.map((flower, i) =>
				flower.bud ? (
					<Bud
						key={i}
						x={flower.at[0]}
						y={flower.at[1]}
						r={4 + r() * 2.5}
						rotate={(flower.angle * 180) / Math.PI + 90}
					/>
				) : (
					<Blossom
						key={i}
						x={flower.at[0] + (r() - 0.5) * 6}
						y={flower.at[1] + (r() - 0.5) * 6}
						r={9 + r() * 6}
						rotate={r() * 72}
					/>
				),
			)}
		</g>
	);
}

// —— 夏：荷叶、花苞与蜻蜓 ——

function LotusLeaf({
	cx,
	cy,
	rx,
	ry,
	notch,
}: {
	cx: number;
	cy: number;
	rx: number;
	ry: number;
	notch: number;
}) {
	const points: Pt[] = [];
	const gap = 0.16;
	for (let i = 0; i <= 64; i++) {
		const t = notch + gap + (i / 64) * (Math.PI * 2 - gap * 2);
		const wave = 1 + 0.035 * Math.sin(t * 9);
		points.push([cx + Math.cos(t) * rx * wave, cy + Math.sin(t) * ry * wave]);
	}
	const hub: Pt = [cx + rx * 0.06, cy - ry * 0.04];
	const outline = `M${f(hub[0])},${f(hub[1])} ${points.map(([x, y]) => `L${f(x)},${f(y)}`).join(" ")} Z`;
	return (
		<g>
			<path
				d={outline}
				style={{ fill: "var(--brand-a4)", stroke: "var(--brand-a8)", strokeWidth: 1 }}
			/>
			{Array.from({ length: 13 }, (_, i) => {
				const t = notch + gap * 2 + (i / 12) * (Math.PI * 2 - gap * 4);
				return (
					<line
						key={i}
						x1={hub[0]}
						y1={hub[1]}
						x2={cx + Math.cos(t) * rx * 0.94}
						y2={cy + Math.sin(t) * ry * 0.94}
						style={{ stroke: "var(--brand-a6)", strokeWidth: 0.8 }}
					/>
				);
			})}
			<circle cx={hub[0]} cy={hub[1]} r={2.4} style={{ fill: "var(--brand-a7)" }} />
		</g>
	);
}

function Dragonfly({
	x,
	y,
	rotate,
	scale = 1,
}: {
	x: number;
	y: number;
	rotate: number;
	scale?: number;
}) {
	const wing = { fill: "var(--neutral-a3)", stroke: "var(--neutral-a8)", strokeWidth: 0.6 };
	return (
		<g transform={`translate(${f(x)} ${f(y)}) rotate(${rotate}) scale(${scale})`}>
			<ellipse cx={-14} cy={-4} rx={15} ry={4} transform="rotate(-14 -14 -4)" style={wing} />
			<ellipse cx={14} cy={-4} rx={15} ry={4} transform="rotate(14 14 -4)" style={wing} />
			<ellipse cx={-12} cy={3} rx={13} ry={3.6} transform="rotate(10 -12 3)" style={wing} />
			<ellipse cx={12} cy={3} rx={13} ry={3.6} transform="rotate(-10 12 3)" style={wing} />
			<line
				x1={0}
				y1={-6}
				x2={0}
				y2={30}
				style={{ stroke: "var(--neutral-11)", strokeWidth: 2, strokeLinecap: "round" }}
			/>
			<circle cx={0} cy={-8} r={2.8} style={{ fill: "var(--neutral-11)" }} />
		</g>
	);
}

function LotusBud({ x, y, height }: { x: number; y: number; height: number }) {
	const top: Pt = [x + height * 0.18, y - height];
	return (
		<g>
			<path
				d={`M${x},${y} Q${f(x - height * 0.12)},${f(y - height * 0.55)} ${f(top[0])},${f(top[1])}`}
				style={{
					fill: "none",
					stroke: "var(--brand-8)",
					strokeWidth: 2.6,
					strokeLinecap: "round",
				}}
			/>
			<g transform={`translate(${f(top[0])} ${f(top[1])}) rotate(8)`}>
				<path
					d="M0,0 C20,-14 17,-46 0,-64 C-17,-46 -20,-14 0,0 Z"
					style={{ fill: "var(--brand-6)", stroke: "var(--brand-9)", strokeWidth: 0.8 }}
				/>
				<path
					d="M0,0 C9,-16 8,-40 0,-64 M0,0 C-9,-16 -8,-40 0,-64"
					style={{ fill: "none", stroke: "var(--brand-9)", strokeWidth: 0.7 }}
				/>
			</g>
		</g>
	);
}

// —— 秋：满月与桂枝 ——

function Leaf({
	x,
	y,
	length,
	width,
	rotate,
	fill,
}: {
	x: number;
	y: number;
	length: number;
	width: number;
	rotate: number;
	fill: string;
}) {
	return (
		<path
			d={`M0,0 Q${f(width)},${f(-length * 0.45)} 0,${f(-length)} Q${f(-width)},${f(-length * 0.45)} 0,0 Z`}
			transform={`translate(${f(x)} ${f(y)}) rotate(${f(rotate)})`}
			style={{ fill }}
		/>
	);
}

function Floret({ x, y, r }: { x: number; y: number; r: number }) {
	return (
		<g transform={`translate(${f(x)} ${f(y)}) rotate(45)`}>
			{[0, 90, 180, 270].map((angle) => (
				<ellipse
					key={angle}
					cy={-r * 0.6}
					rx={r * 0.48}
					ry={r * 0.62}
					transform={`rotate(${angle})`}
					style={{ fill: "var(--brand-9)" }}
				/>
			))}
		</g>
	);
}

function OsmanthusSprig({
	seed,
	origin,
	angle,
	length,
	width,
}: {
	seed: number;
	origin: Pt;
	angle: number;
	length: number;
	width: number;
}) {
	const tree = growTree(seed, origin, angle, length, width, 1, 2);
	const r = mulberry32(seed + 3);
	const leafFill =
		"light-dark(color-mix(in oklch, var(--neutral-12) 82%, transparent), var(--neutral-4))";
	return (
		<g>
			{tree.limbs.map((limb, i) => (
				<path key={i} d={taperedPath(limb)} style={{ fill: leafFill }} />
			))}
			{tree.nodes
				.filter((_, i) => i % 2 === 0)
				.map((node, i) => {
					const base = (node.angle * 180) / Math.PI + 90;
					const side = i % 2 === 0 ? 1 : -1;
					return (
						<g key={i}>
							<Leaf
								x={node.at[0]}
								y={node.at[1]}
								length={34 + r() * 16}
								width={8 + r() * 4}
								rotate={base + side * (48 + r() * 14)}
								fill={leafFill}
							/>
							{r() < 0.7
								? Array.from({ length: 4 + Math.floor(r() * 4) }, (_, k) => (
										<Floret
											key={k}
											x={node.at[0] + (r() - 0.5) * 16}
											y={node.at[1] + (r() - 0.5) * 12}
											r={2.6 + r()}
										/>
									))
								: null}
						</g>
					);
				})}
			{tree.tips.map((tip, i) => (
				<Leaf
					key={i}
					x={tip.at[0]}
					y={tip.at[1]}
					length={30}
					width={8}
					rotate={(tip.angle * 180) / Math.PI + 90}
					fill={leafFill}
				/>
			))}
		</g>
	);
}

// —— 冬：积雪枯枝 ——

function SnowyBranch({
	seed,
	origin,
	angle,
	length,
	width,
}: {
	seed: number;
	origin: Pt;
	angle: number;
	length: number;
	width: number;
}) {
	const tree = growTree(seed, origin, angle, length, width, 2, 3);
	return (
		<g>
			{tree.limbs.map((limb, i) => (
				<path key={i} d={taperedPath(limb)} style={{ fill: BRANCH }} />
			))}
			{tree.limbs.map((limb, i) => {
				const d = snowPath(limb, seed + i);
				return d ? (
					<path
						key={`s${i}`}
						d={d}
						style={{ fill: SNOW, stroke: "var(--neutral-a7)", strokeWidth: 0.7 }}
					/>
				) : null;
			})}
		</g>
	);
}

// —— 组合 ——

/** 背景层：视口角落的大幅插画。 */
export function CornerIllustration({ season }: { season: SeasonKey }) {
	switch (season) {
		case "spring":
			return (
				<svg
					aria-hidden="true"
					viewBox="0 0 560 440"
					className="absolute top-0 right-0 w-[min(40vw,560px)] mask-[radial-gradient(circle_at_100%_0%,#000_58%,transparent_92%)]"
				>
					<SpringBranch
						seed={11}
						origin={[580, 24]}
						angle={Math.PI - 0.5}
						length={460}
						width={11}
						depth={2}
					/>
				</svg>
			);
		case "summer":
			return (
				<svg
					aria-hidden="true"
					viewBox="0 0 560 360"
					className="absolute bottom-0 left-0 w-[min(42vw,560px)] mask-[radial-gradient(circle_at_0%_100%,#000_60%,transparent_92%)]"
				>
					<ellipse
						cx={300}
						cy={330}
						rx={150}
						ry={34}
						style={{ fill: "none", stroke: "var(--brand-a5)", strokeWidth: 0.8 }}
					/>
					<ellipse
						cx={300}
						cy={330}
						rx={196}
						ry={46}
						style={{ fill: "none", stroke: "var(--brand-a4)", strokeWidth: 0.8 }}
					/>
					<LotusLeaf cx={110} cy={318} rx={170} ry={70} notch={-1.2} />
					<LotusBud x={238} y={300} height={150} />
					<LotusLeaf cx={312} cy={344} rx={112} ry={42} notch={-2.1} />
					<Dragonfly x={293} y={84} rotate={-24} scale={0.95} />
				</svg>
			);
		case "autumn":
			return (
				<svg
					aria-hidden="true"
					viewBox="0 0 560 440"
					className="absolute top-0 right-0 w-[min(40vw,560px)] mask-[radial-gradient(circle_at_100%_0%,#000_60%,transparent_94%)]"
				>
					<circle cx={380} cy={150} r={150} style={{ fill: "var(--brand-a2)" }} />
					<circle
						cx={380}
						cy={150}
						r={104}
						style={{
							fill: "light-dark(var(--brand-4), color-mix(in oklch, var(--brand-11) 32%, transparent))",
						}}
					/>
					<OsmanthusSprig
						seed={5}
						origin={[590, 300]}
						angle={Math.PI + 0.42}
						length={330}
						width={5}
					/>
				</svg>
			);
		case "winter":
			return (
				<svg
					aria-hidden="true"
					viewBox="0 0 560 420"
					className="absolute top-0 left-0 w-[min(40vw,560px)] mask-[radial-gradient(circle_at_0%_0%,#000_58%,transparent_92%)]"
				>
					<SnowyBranch
						seed={23}
						origin={[-20, 150]}
						angle={0.1}
						length={520}
						width={13}
					/>
				</svg>
			);
	}
}

/** 点缀位：首页寄语上方的小幅插画。 */
export function VignetteIllustration({ season }: { season: SeasonKey }) {
	switch (season) {
		case "spring":
			return (
				<svg aria-hidden="true" viewBox="0 0 220 90" className="mx-auto mb-6 h-18">
					<SpringBranch
						seed={31}
						origin={[10, 60]}
						angle={-0.18}
						length={200}
						width={4.5}
						depth={1}
					/>
				</svg>
			);
		case "summer":
			return (
				<svg aria-hidden="true" viewBox="0 0 220 110" className="mx-auto mb-6 h-22">
					<LotusLeaf cx={84} cy={96} rx={70} ry={14} notch={-1.4} />
					<LotusBud x={118} y={96} height={30} />
					<Dragonfly x={170} y={40} rotate={60} scale={0.55} />
				</svg>
			);
		case "autumn":
			return (
				<svg aria-hidden="true" viewBox="0 0 220 100" className="mx-auto mb-6 h-20">
					<circle
						cx={110}
						cy={50}
						r={40}
						style={{
							fill: "light-dark(var(--brand-4), color-mix(in oklch, var(--brand-11) 32%, transparent))",
						}}
					/>
					<OsmanthusSprig
						seed={9}
						origin={[214, 74]}
						angle={Math.PI + 0.2}
						length={150}
						width={2.6}
					/>
				</svg>
			);
		case "winter":
			return (
				<svg aria-hidden="true" viewBox="0 0 220 80" className="mx-auto mb-6 h-16">
					<SnowyBranch seed={41} origin={[6, 44]} angle={-0.06} length={210} width={5} />
				</svg>
			);
	}
}

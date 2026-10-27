/**
 * 秋：满月与桂枝。月亮带光晕先浮现，一枝桂花剪影横过月前，
 * 叶片从叶柄展开，细小的四瓣花簇逐簇亮起。
 */
import { deg, growTree, mulberry32, type Pt } from "../../model/geometry";
import { leafPath } from "../../model/shapes";
import styles from "../../scene.module.css";
import { GrowingLimb, RoughFilter, timing } from "./parts";

/** 一簇桂花：四片椭圆花瓣围一圈，中心一点花心。 */
function Floret({ x, y, r, time }: { x: number; y: number; r: number; time: number }) {
	return (
		<g transform={`translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(45)`}>
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

export interface OsmanthusSprigProps {
	seed: number;
	/** 枝条根部坐标 */
	origin: Pt;
	/** 主干生长方向（弧度） */
	angle: number;
	length: number;
	width: number;
	prefix: string;
	/** 整枝缩放，compact 场景用它缩小叶片与花簇 */
	scale?: number;
}

/** 一小枝桂花：枝条、披针叶与散生的花簇。 */
function OsmanthusSprig({
	seed,
	origin,
	angle,
	length,
	width,
	prefix,
	scale = 1,
}: OsmanthusSprigProps) {
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
								transform={`translate(${node.at[0].toFixed(1)} ${node.at[1].toFixed(1)}) rotate(${(base + side * (46 + r() * 16)).toFixed(1)})`}
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
									d={`M0,0 L0,${(-length * 0.9).toFixed(1)}`}
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
					transform={`translate(${tip.at[0].toFixed(1)} ${tip.at[1].toFixed(1)}) rotate(${(deg(tip.angle) + 90).toFixed(1)})`}
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

/** 秋景：compact 用于点缀位的小幅插画。 */
export function AutumnScene({ prefix, compact }: { prefix: string; compact?: boolean }) {
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

/**
 * 冬：积雪枯枝。枝条从画面外伸入，枝头几簇红果，雪只在接近水平的枝段堆住，
 * 自下而上堆起。
 */
import { growTree, mulberry32, type Pt, snowPath } from "../../model/geometry";
import styles from "../../scene.module.css";
import { GrowingLimb, RoughFilter, timing } from "./parts";

export interface SnowyBranchProps {
	seed: number;
	/** 枝条根部坐标 */
	origin: Pt;
	/** 主干生长方向（弧度） */
	angle: number;
	length: number;
	width: number;
	prefix: string;
	/** 枝头是否带红果；compact 场景省去 */
	berries?: boolean;
}

function SnowyBranch({
	seed,
	origin,
	angle,
	length,
	width,
	prefix,
	berries = true,
}: SnowyBranchProps) {
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

/** 冬景：compact 用于点缀位的小幅插画，不带红果。 */
export function WinterScene({ prefix, compact }: { prefix: string; compact?: boolean }) {
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

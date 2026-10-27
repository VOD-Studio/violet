/**
 * 春：桃枝。前景一枝从画面外伸入，枝上着花、花苞与嫩叶；远处一枝虚化的远枝。
 */
import { deg, growTree, mulberry32, type Pt } from "../../model/geometry";
import { Blossom, Bud, GrowingLimb, PetalGradients, RoughFilter, SproutLeaf } from "./parts";

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

/** 春景：compact 用于点缀位的小幅插画。 */
export function SpringScene({ prefix, compact }: { prefix: string; compact?: boolean }) {
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

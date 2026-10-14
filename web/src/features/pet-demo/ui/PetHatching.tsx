import styles from "./PetHatching.module.css";

const PALETTE: Record<string, string> = {
	o: "#3a3250",
	b: "#f4ecd9",
	l: "#fffaf0",
	s: "#e2d5ba",
	k: "#3a3250",
};

const EGG = [
	"....oooo....",
	"...obbbbo...",
	"..obllbbbo..",
	".obllbbbbbo.",
	".obbbbbsbbo.",
	"obbbsbbbbbbo",
	"obbbbbbbbsbo",
	"obsbbbbbbbbo",
	"obbbbbbsbbbo",
	".obbbbbbbbo.",
	"..oobbbboo..",
	"....oooo....",
];

const CRACK = ["....k.k.....", ".....k.k...."];

function Rows({ rows, dx = 0, dy = 0 }: { rows: string[]; dx?: number; dy?: number }) {
	return rows.flatMap((row, y) =>
		[...row].map((key, x) =>
			key === "." ? null : (
				<rect
					key={`${x}-${y}`}
					x={x + dx}
					y={y + dy}
					width={1}
					height={1}
					fill={PALETTE[key]}
				/>
			),
		),
	);
}

/** 加载态:一颗像素蛋左右晃动后裂开,与页面里的像素画同一套绘制方式。 */
export function PetHatching() {
	return (
		<svg
			viewBox="0 0 16 16"
			role="img"
			aria-label="正在孵化"
			shapeRendering="crispEdges"
			className="mx-auto block w-full max-w-60"
		>
			<ellipse cx={8} cy={14.4} rx={4.5} ry={0.6} fill="currentColor" opacity={0.1} />
			<g className={`${styles.frame} ${styles.rest}`}>
				<Rows rows={EGG} dx={2} dy={2} />
			</g>
			<g className={`${styles.frame} ${styles.left}`}>
				<Rows rows={EGG} dx={1} dy={2} />
			</g>
			<g className={`${styles.frame} ${styles.right}`}>
				<Rows rows={EGG} dx={3} dy={2} />
			</g>
			<g className={styles.crack}>
				<Rows rows={CRACK} dx={2} dy={5} />
			</g>
		</svg>
	);
}

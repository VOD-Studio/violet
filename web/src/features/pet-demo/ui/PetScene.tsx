import { useMemo } from "react";
import type { Sprite } from "../model/types";

interface Run {
	x: number;
	y: number;
	len: number;
	key: string;
}

function runsOf(sprite: Sprite): Run[] {
	const runs: Run[] = [];
	sprite.rows.forEach((row, y) => {
		let x = 0;
		while (x < row.length) {
			const key = row[x];
			if (key === ".") {
				x += 1;
				continue;
			}
			let len = 1;
			while (row[x + len] === key) len += 1;
			runs.push({ x, y, len, key });
			x += len;
		}
	});
	return runs;
}

/** 精灵左右边界,用于把落地阴影放在宠物脚下。 */
function footSpan(sprite: Sprite): [number, number] {
	let min = sprite.w;
	let max = 0;
	for (const row of sprite.rows.slice(-4)) {
		for (let x = 0; x < row.length; x++) {
			if (row[x] !== ".") {
				min = Math.min(min, x);
				max = Math.max(max, x);
			}
		}
	}
	return min <= max ? [min, max + 1] : [0, 0];
}

/** 像素宠物与地面:SVG 逐像素绘制,整数网格放大,不做插值。 */
export function PetScene({ sprite, label }: { sprite: Sprite; label: string }) {
	const runs = useMemo(() => runsOf(sprite), [sprite]);
	const [from, to] = footSpan(sprite);
	const floorY = sprite.h;
	return (
		<svg
			viewBox={`0 0 ${sprite.w} ${sprite.h + 2}`}
			role="img"
			aria-label={label}
			shapeRendering="crispEdges"
			className="mx-auto block w-full max-w-xl"
		>
			{to > from ? (
				<ellipse
					cx={(from + to) / 2}
					cy={floorY + 0.4}
					rx={(to - from) / 2 + 1}
					ry={0.7}
					fill="currentColor"
					opacity={0.1}
				/>
			) : null}
			<line
				x1={0}
				y1={floorY + 0.5}
				x2={sprite.w}
				y2={floorY + 0.5}
				stroke="currentColor"
				strokeWidth={0.18}
				strokeDasharray="0.6 0.9"
				opacity={0.25}
			/>
			{runs.map((r) => (
				<rect
					key={`${r.x}-${r.y}`}
					x={r.x}
					y={r.y}
					width={r.len}
					height={1}
					fill={sprite.palette[r.key]}
				/>
			))}
		</svg>
	);
}

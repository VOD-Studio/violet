import {
	arc,
	circle,
	curve,
	ellipse,
	fills,
	line,
	type Palette,
	pathFromSvg,
	polygon,
	polyline,
	rect,
	type SceneItem,
} from "@violet/sketch";

/** 内置填充名，同时是 Rough.js 的 fillStyle。 */
export type FillId = keyof typeof fills;

/** 对照场景中的图元：fill 同时决定两侧的填充方式。 */
export interface BenchItem extends Omit<SceneItem, "style"> {
	fill?: FillId;
}

export interface BenchScene {
	width: number;
	height: number;
	items: readonly BenchItem[];
}

export const FILL_LABELS: Record<FillId, string> = {
	solid: "实色",
	hachure: "排线",
	"cross-hatch": "交叉",
	dashed: "虚线",
	zigzag: "往返",
	"zigzag-line": "锯齿",
	dots: "点阵",
};

export const palette: Palette = {
	paper: "#fffdf7",
	ink: "#2b2836",
	sky: "#b9dbea",
	rose: "#f4c1c7",
	mint: "#bfdcc4",
	lilac: "#d4c8ec",
	sun: "#f2d38f",
};

const tones = ["sky", "rose", "mint", "lilac", "sun"] as const;
export const tone = (i: number) => tones[i % tones.length];

const caption = (text: string, x: number, y: number) => ({ text, x, y, size: 13 });

/** 基础图元表：每格一个图元，标签位于下方。 */
export function primitivesScene(fill: FillId): BenchScene {
	const cells: [string, BenchItem["path"], boolean][] = [
		["line", line(40, 110, 250, 40), false],
		["rect", rect(340, 40, 200, 100), true],
		["rounded rect", rect(640, 40, 200, 100, 18), true],
		["circle", circle(145, 255, 62), true],
		["ellipse", ellipse(440, 255, 108, 58), true],
		[
			"polyline",
			polyline([
				[640, 300],
				[690, 210],
				[745, 280],
				[795, 200],
				[840, 300],
			]),
			false,
		],
		[
			"polygon",
			polygon([
				[145, 400],
				[230, 450],
				[200, 530],
				[90, 530],
				[60, 450],
			]),
			true,
		],
		["arc", arc(440, 500, 100, 70, Math.PI * 1.05, Math.PI * 1.95), false],
		[
			"curve",
			curve([
				[640, 500],
				[690, 420],
				[740, 520],
				[790, 430],
				[840, 500],
			]),
			false,
		],
	];
	return {
		width: 900,
		height: 600,
		items: cells.map(([name, path], i) => {
			const col = i % 3;
			const row = Math.floor(i / 3);
			const closed = cells[i][2];
			return {
				id: name,
				path,
				fillRole: closed ? tone(i) : undefined,
				fill: closed ? fill : undefined,
				label: caption(name, 145 + col * 295, 175 + row * 200),
			};
		}),
	};
}

/** 七种填充：方块与圆各一行。 */
export function fillsScene(): BenchScene {
	const ids = Object.keys(fills) as FillId[];
	const items: BenchItem[] = [];
	ids.forEach((id, i) => {
		const x = 30 + i * 125;
		items.push(
			{
				id: `${id}-square`,
				path: rect(x, 30, 100, 100, 10),
				fillRole: tone(i),
				fill: id,
				label: caption(FILL_LABELS[id], x + 50, 152),
			},
			{ id: `${id}-circle`, path: circle(x + 50, 230, 50), fillRole: tone(i + 2), fill: id },
		);
	});
	return { width: 900, height: 300, items };
}

/** 复合路径的三种孔洞情形。 */
export function holesScene(fill: FillId): BenchScene {
	const items: [string, string, "evenodd" | "nonzero", string][] = [
		["evenodd", "M30 30H270V250H30ZM100 95H200V185H100Z", "evenodd", "evenodd · 同向 → 孔洞"],
		[
			"nonzero-filled",
			"M330 30H570V250H330ZM400 95H500V185H400Z",
			"nonzero",
			"nonzero · 同向 → 填满",
		],
		[
			"nonzero-hole",
			"M630 30H870V250H630ZM700 95V185H800V95Z",
			"nonzero",
			"nonzero · 反向 → 孔洞",
		],
	];
	return {
		width: 900,
		height: 300,
		items: items.map(([id, d, rule, text], i) => ({
			id,
			path: pathFromSvg(d, rule),
			fillRole: tone(i),
			fill,
			label: caption(text, 150 + i * 300, 278),
		})),
	};
}

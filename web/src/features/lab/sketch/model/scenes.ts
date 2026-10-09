import {
	arc,
	cartoonPalette,
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

export type SceneKey = "primitives" | "fills" | "holes" | "illustration" | "mermaid";

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

/** 全部场景共用的基础色；卡通风格需要的阴影、高光与线色由 cartoonPalette 派生。 */
export const palette: Palette = cartoonPalette({
	paper: "#fffdf7",
	ink: "#2b2836",
	sky: "#b9dbea",
	rose: "#f4c1c7",
	mint: "#bfdcc4",
	lilac: "#d4c8ec",
	sun: "#f2d38f",
	moon: "#f7e6a1",
	crater: "#e9d38b",
	star: "#fff1b8",
	cloud: "#dfe7f6",
	hill: "#8fc9a4",
	hillFar: "#a9d6b8",
	wall: "#f4d8c4",
	roof: "#d96b6b",
	chimney: "#c98d78",
	door: "#9a6b4f",
	glass: "#bfe3ff",
	trunk: "#a67c5b",
	leaf: "#78c28c",
	leafDeep: "#5fae7c",
});

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

/** 四角星。 */
function star(cx: number, cy: number, r: number) {
	const points: [number, number][] = [];
	for (let i = 0; i < 8; i++) {
		const a = (Math.PI * i) / 4 - Math.PI / 2;
		const d = i % 2 ? r * 0.38 : r;
		points.push([cx + d * Math.cos(a), cy + d * Math.sin(a)]);
	}
	return polygon(points);
}

/** 夜晚小屋：卡通风格的完整插画，覆盖大小形状、色线与分层明暗。 */
export function illustrationScene(): BenchScene {
	const big = 2.6;
	const mid = 2;
	const fine = 1.1;
	const shape = (
		id: string,
		path: BenchItem["path"],
		fillRole: string,
		lineWidth: number,
	): BenchItem => ({ id, path, fillRole, lineWidth });
	return {
		width: 900,
		height: 600,
		items: [
			shape("moon", circle(730, 130, 62), "moon", big),
			shape("crater-a", circle(708, 112, 11), "crater", fine),
			shape("crater-b", circle(752, 150, 8), "crater", fine),
			shape("crater-c", circle(742, 100, 5), "crater", fine),
			shape("star-a", star(130, 90, 24), "star", fine),
			shape("star-b", star(330, 60, 17), "star", fine),
			shape("star-c", star(540, 120, 21), "star", fine),
			shape("star-d", star(610, 50, 14), "star", fine),
			shape("star-e", star(845, 270, 18), "star", fine),
			shape("cloud-a", ellipse(250, 190, 70, 30), "cloud", mid),
			shape("cloud-b", ellipse(205, 175, 38, 26), "cloud", mid),
			shape("cloud-c", ellipse(290, 172, 44, 30), "cloud", mid),
			shape(
				"hill-far",
				pathFromSvg(
					"M40 470C150 360 290 350 410 430C500 490 600 470 700 430C770 400 830 410 870 440L870 550L40 550Z",
				),
				"hillFar",
				big,
			),
			shape(
				"hill",
				pathFromSvg("M40 520C90 430 230 400 330 440C430 480 470 520 480 550L40 550Z"),
				"hill",
				big,
			),
			shape("chimney", rect(448, 262, 30, 70, 4), "chimney", mid),
			shape("wall", rect(300, 330, 210, 160, 6), "wall", big),
			shape(
				"roof",
				polygon([
					[272, 336],
					[405, 235],
					[538, 336],
				]),
				"roof",
				big,
			),
			shape("door", pathFromSvg("M378 490V430C378 408 432 408 432 430V490Z"), "door", mid),
			shape("window-a", rect(322, 362, 42, 42, 4), "glass", mid),
			shape("window-b", rect(450, 362, 42, 42, 4), "glass", mid),
			shape("trunk", rect(660, 410, 26, 90, 3), "trunk", mid),
			shape("canopy", circle(673, 372, 62), "leaf", big),
			shape("canopy-side", circle(622, 408, 38), "leafDeep", mid),
		],
	};
}

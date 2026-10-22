import {
	createSchedule,
	type Drawing,
	draw,
	fills,
	lineWashStyle,
	type Palette,
	pathFromSvg,
	rect,
	type SceneItem,
	type Schedule,
	type ScheduleMode,
} from "@violetjs/inkline";

/** 画稿 JSON：底纸、平涂色面、实墨区域与带线宽的中心线。 */
export interface VectorArtwork {
	width: number;
	height: number;
	/** 铺满画面的底纸颜色角色；缺省时用白纸 */
	paperRole?: string;
	/** 实墨区域与中心线未指定角色时的墨色角色 */
	inkRole?: string;
	palette: Palette;
	colors: readonly { role: string; paths: readonly string[] }[];
	ink: readonly { path: string; role?: string }[];
	strokes: readonly { width: number; path: string; role?: string }[];
}

/** 画好的画稿：Drawing、补齐背景色的配色与播放分段。 */
export interface InkedArtwork {
	drawing: Drawing;
	palette: Palette;
	/** 播放分段，每段是图元下标；段内按编排方式排，段与段首尾相接 */
	phases: readonly (readonly number[])[];
}

const PAPER = "#ffffff";
const INK = "#2a2420";

/**
 * 用 G 笔与实色填充勾画画稿；附加色面层按传入顺序叠在原色面之上。
 *
 * @param phased - true 时分三段播放：底纸、线稿与实墨、色面；false 时整幅一段
 */
export function inkArtwork(
	art: VectorArtwork,
	layers: readonly VectorArtwork["colors"][] = [],
	phased = true,
): InkedArtwork {
	const ink = art.inkRole ?? "ink";
	const paper: SceneItem = {
		id: "paper",
		path: rect(0, 0, art.width, art.height),
		strokeRole: "none",
		fillRole: art.paperRole ?? "paper",
	};
	const colors = [art.colors, ...layers].flatMap((group, layer) =>
		group.flatMap(({ role, paths }) =>
			paths.map(
				(d, i): SceneItem => ({
					id: `${role}-${layer}-${i}`,
					path: pathFromSvg(d, "evenodd"),
					strokeRole: "none",
					fillRole: role,
				}),
			),
		),
	);
	const inkAreas = art.ink.map(
		({ path, role }, i): SceneItem => ({
			id: `ink-${i}`,
			path: pathFromSvg(path, "evenodd"),
			strokeRole: "none",
			fillRole: role ?? ink,
		}),
	);
	const strokes = art.strokes.map(
		({ width, path, role }, i): SceneItem => ({
			id: `stroke-${i}`,
			path: pathFromSvg(path),
			lineWidth: width,
			strokeRole: role ?? ink,
		}),
	);
	const items = [paper, ...colors, ...inkAreas, ...strokes];
	const drawing = draw(
		{ width: art.width, height: art.height, items },
		{ style: { ...lineWashStyle, fill: fills.solid }, seed: 7, width: 1.6 },
	);
	const range = (from: number, count: number) =>
		Array.from({ length: count }, (_, i) => from + i);
	const lines = range(1 + colors.length, inkAreas.length + strokes.length);
	return {
		drawing,
		// 渲染与导出默认以 paper 角色作背景，ink 角色兜底未指定颜色的笔画
		palette: {
			...art.palette,
			paper: (art.paperRole && art.palette[art.paperRole]) || PAPER,
			ink: art.palette[ink] ?? INK,
		},
		phases: phased ? [[0], lines, range(1, colors.length)] : [range(0, items.length)],
	};
}

/** 分段编排：每段内部按 mode 排，段与段首尾相接，色面始终叠在线稿下方。 */
export function phasedSchedule(
	drawing: Drawing,
	phases: readonly (readonly number[])[],
	mode: ScheduleMode,
): Schedule {
	const start = new Float32Array(drawing.items.length);
	const end = new Float32Array(drawing.items.length);
	let duration = 0;
	for (const indices of phases) {
		if (indices.length === 0) continue;
		const phase = createSchedule(
			{ ...drawing, items: indices.map((index) => drawing.items[index]) },
			{ mode },
		);
		indices.forEach((index, position) => {
			start[index] = duration + phase.start[position];
			end[index] = duration + phase.end[position];
		});
		duration += phase.duration;
	}
	return { mode, start, end, duration };
}

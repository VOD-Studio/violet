import type { BenchScene } from "@features/lab/sketch/model/scenes";
import { pathFromSvg } from "@violet/sketch";
import source from "./good-morning.json?raw";

interface Artwork {
	width: number;
	height: number;
	colors: readonly { role: string; paths: readonly string[] }[];
	ink: readonly string[];
	strokes: readonly { width: number; path: string }[];
}

const artwork: Artwork = JSON.parse(source);

/** 人物举牌的矢量场景；色块不描边，眼瞳等墨色区域使用实色。 */
export const goodMorningScene: BenchScene = {
	width: artwork.width,
	height: artwork.height,
	items: [
		...artwork.colors.flatMap(({ role, paths }) =>
			paths.map((d, i) => ({
				id: `${role}-${i}`,
				path: pathFromSvg(d, "evenodd"),
				strokeRole: "none",
				fillRole: role,
			})),
		),
		...artwork.ink.map((d, i) => ({
			id: `ink-${i}`,
			path: pathFromSvg(d, "evenodd"),
			strokeRole: "none",
			fillRole: "ink",
			fill: "solid" as const,
		})),
		...artwork.strokes.map(({ width, path }, i) => ({
			id: `stroke-${i}`,
			path: pathFromSvg(path),
			lineWidth: width,
		})),
	],
};

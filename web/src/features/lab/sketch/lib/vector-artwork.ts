import type { BenchScene } from "@features/lab/sketch/model/scenes";
import { type Palette, pathFromSvg } from "@violet/sketch";

interface VectorArtwork {
	width: number;
	height: number;
	palette: Palette;
	colors: readonly { role: string; paths: readonly string[] }[];
	ink: readonly string[];
	strokes: readonly { width: number; path: string }[];
}

/**
 * 将色块、实墨区域与中心线转为可复用的场景几何和调色板。
 *
 * @remarks 附加色面文件按传入顺序叠放在底色上。
 */
export function parseVectorArtwork(
	source: string,
	...layers: string[]
): { scene: BenchScene; palette: Palette } {
	const artwork: VectorArtwork = JSON.parse(source);
	const colorLayers = [
		artwork.colors,
		...layers.map((layer) => JSON.parse(layer) as VectorArtwork["colors"]),
	];
	return {
		palette: artwork.palette,
		scene: {
			width: artwork.width,
			height: artwork.height,
			items: [
				...colorLayers.flatMap((colors) =>
					colors.flatMap(({ role, paths }) =>
						paths.map((d, i) => ({
							id: `${role}-${i}`,
							path: pathFromSvg(d, "evenodd"),
							strokeRole: "none",
							fillRole: role,
						})),
					),
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
		},
	};
}

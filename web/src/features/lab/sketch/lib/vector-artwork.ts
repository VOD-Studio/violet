import type { BenchScene } from "@features/lab/sketch/model/scenes";
import { type Palette, pathFromSvg, rect } from "@violetjs/inkline";

interface VectorArtwork {
	width: number;
	height: number;
	paperRole?: string;
	inkRole?: string;
	palette: Palette;
	colors: readonly { role: string; paths: readonly string[] }[];
	ink: readonly { path: string; role?: string }[];
	strokes: readonly { width: number; path: string; role?: string }[];
}

/**
 * 将色块、实墨区域与中心线转为可复用的场景几何和调色板。
 *
 * @remarks 画稿可指定底纸、逐区墨色与逐条线色；附加色面按传入顺序叠放。
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
				...(artwork.paperRole
					? [
							{
								id: "paper",
								path: rect(0, 0, artwork.width, artwork.height),
								strokeRole: "none",
								fillRole: artwork.paperRole,
								fill: "solid" as const,
							},
						]
					: []),
				...colorLayers.flatMap((colors, layer) =>
					colors.flatMap(({ role, paths }) =>
						paths.map((d, i) => ({
							id: `${role}-${layer}-${i}`,
							path: pathFromSvg(d, "evenodd"),
							strokeRole: "none",
							fillRole: role,
						})),
					),
				),
				...artwork.ink.map(({ path, role }, i) => ({
					id: `ink-${i}`,
					path: pathFromSvg(path, "evenodd"),
					strokeRole: "none",
					fillRole: role ?? artwork.inkRole ?? "ink",
					fill: "solid" as const,
				})),
				...artwork.strokes.map(({ width, path, role }, i) => ({
					id: `stroke-${i}`,
					path: pathFromSvg(path),
					lineWidth: width,
					strokeRole: role ?? artwork.inkRole,
				})),
			],
		},
	};
}

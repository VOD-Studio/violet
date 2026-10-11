import {
	draw,
	fills,
	lineWashStyle,
	type Palette,
	pathFromSvg,
	rect,
	type SceneItem,
} from "@violetjs/inkline";
import { renderSvg } from "@violetjs/inkline/svg";

// #region readme
/** Vector artwork: flat color regions under solid ink areas and centerlines with their own widths. */
export interface Artwork {
	width: number;
	height: number;
	palette: Palette;
	/** Fill role for a full-size background rectangle. */
	paperRole?: string;
	/** Color role for ink areas and centerlines without their own role. */
	inkRole: string;
	colors: { role: string; paths: string[] }[];
	ink: { path: string; role?: string }[];
	strokes: { width: number; path: string; role?: string }[];
}

export function inkArtwork(art: Artwork): string {
	const items: SceneItem[] = [
		...(art.paperRole
			? [
					{
						id: "paper",
						path: rect(0, 0, art.width, art.height),
						strokeRole: "none",
						fillRole: art.paperRole,
					},
				]
			: []),
		...art.colors.flatMap(({ role, paths }) =>
			paths.map(
				(d, i): SceneItem => ({
					id: `${role}-${i}`,
					path: pathFromSvg(d, "evenodd"),
					strokeRole: "none",
					fillRole: role,
				}),
			),
		),
		...art.ink.map(
			({ path, role }, i): SceneItem => ({
				id: `ink-${i}`,
				path: pathFromSvg(path, "evenodd"),
				strokeRole: "none",
				fillRole: role ?? art.inkRole,
			}),
		),
		// Each centerline keeps the width it was traced with; the G pen tapers it by pressure.
		...art.strokes.map(
			({ width, path, role }, i): SceneItem => ({
				id: `stroke-${i}`,
				path: pathFromSvg(path),
				lineWidth: width,
				strokeRole: role ?? art.inkRole,
			}),
		),
	];
	// lineWashStyle already uses the G pen; flat colors instead of the wash keep the artwork's own shading
	const style = { ...lineWashStyle, fill: fills.solid };
	const drawing = draw(
		{ width: art.width, height: art.height, items },
		{ style, seed: 7, width: 1.6 },
	);
	// One decimal place is plenty for a large drawing and keeps the markup smaller.
	return renderSvg(drawing, art.palette, { decimals: 1, background: false });
}
// #endregion

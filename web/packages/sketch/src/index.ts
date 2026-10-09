export { arrowForPath, waveGeometry } from "./decorations.ts";
export { fills } from "./fills.ts";
export { BudgetExceeded, generateScene } from "./generate.ts";
export {
	circleGeometry,
	geometryFromCommands,
	geometryFromPath,
	polyline,
	rectangleGeometry,
	sampleGeometry,
} from "./geometry.ts";
export type { ComicOptions } from "./pens/comic.ts";
export { createComicPen } from "./pens/comic.ts";
export type { NaturalOptions } from "./pens/natural.ts";
export { createNaturalPen } from "./pens/natural.ts";
export type { PencilOptions } from "./pens/pencil.ts";
export { createPencilPen } from "./pens/pencil.ts";
export type { PressureOptions } from "./pens/pressure.ts";
export { createPressurePen } from "./pens/pressure.ts";
export { drawCanvas } from "./renderers/canvas.ts";
export { mountSvg, updateSvgPalette, updateSvgProgress } from "./renderers/svg.ts";
export type {
	Bounds,
	Budget,
	Command,
	Contour,
	DrawnItem,
	DrawnScene,
	Fill,
	GenerateOptions,
	Geometry,
	InkLayer,
	Palette,
	Pen,
	PenContext,
	Sample,
	Scene,
	SceneItem,
} from "./types.ts";

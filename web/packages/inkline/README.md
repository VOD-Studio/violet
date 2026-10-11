# @violetjs/inkline

English | [简体中文](https://github.com/VOD-Studio/violet/blob/release/2.0/web/packages/inkline/README.zh-CN.md)

Hand-drawn vector inking for SVG and Canvas. Give it shapes or SVG paths and it draws them the way a person would: it plans the strokes, moves the hand, presses the pen and fills the shapes. One result renders to both SVG and Canvas.

<p align="center">
  <img src="https://raw.githubusercontent.com/VOD-Studio/violet/release/2.0/web/packages/inkline/docs/images/illustration.svg" width="460" alt="A girl holding a coffee mug, inked with the G pen">
</p>
<p align="center"><sub>Plain vector data, centerlines and flat color regions, inked with the G pen. See <a href="#ink-vector-artwork">Ink vector artwork</a>.</sub></p>

- **Strokes that look drawn, not jittered.** Corners break and cross, long lines are drawn in several strokes, and closed shapes overlap where the pen started.
- **Pens with pressure.** Fineliner, ink pen, marker and G pen are built in. Every pen's pressure strength is adjustable, and you can write your own pens.
- **Fills and wash.** Seven pattern fills, plus a watercolor-like wash that leaves paper-white highlights and hatches the shadow side.
- **Draw-on animation.** Replay a drawing stroke by stroke, in sequence, in parallel or staggered. Seek, pause and reverse without redrawing.
- **Deterministic.** The same input and seed always give the same output, and editing one shape never changes the others.
- **Small and framework-agnostic.** About 10 KB gzipped with the default pen and the SVG renderer, and only one dependency.

## Install

```sh
npm install @violetjs/inkline
```

## Quick start

![A rounded card with hachure fill](https://raw.githubusercontent.com/VOD-Studio/violet/release/2.0/web/packages/inkline/docs/images/quick-start.svg)

<!-- example: quick-start -->

```ts
import { draw, fills, rect, styles } from "@violetjs/inkline";
import { renderSvg } from "@violetjs/inkline/svg";

const drawing = draw(
	{
		width: 240,
		height: 150,
		items: [{ id: "card", path: rect(20, 20, 200, 110, 12), fillRole: "surface" }],
	},
	{ style: { ...styles.natural, fill: fills.hachure }, seed: 35 },
);

// SVG markup as a string. In the browser, mountSvg(drawing, palette) returns an <svg> element.
const svg = renderSvg(drawing, { paper: "#fffdf7", ink: "#252332", surface: "#8f7ad1" });
```

<!-- /example -->

A scene is a list of items. Each item has a stable `id`, a `path`, and optional color roles: `fillRole` and `strokeRole`, which defaults to `ink`. Roles are resolved against a palette when you render, so you can recolor a drawing without generating it again.

## Examples

Every snippet comes from a file in [`examples/`](https://github.com/VOD-Studio/violet/tree/release/2.0/web/packages/inkline/examples), with imports and rendering left out. The shape examples show the `style` and `items` passed to `draw`, set up and rendered as in [Quick start](#quick-start); the image above each one is that file's output, with shapes in the same order as the lines.

### Pens

![The same shapes drawn with four pens](https://raw.githubusercontent.com/VOD-Studio/violet/release/2.0/web/packages/inkline/docs/images/pens.svg)

<!-- example: pens -->

```ts
const style = styles.natural;
const items: SceneItem[] = [
	{ id: "a", path: rect(20, 20, 100, 80), style: { ...style, pen: fineliner } }, // constant width
	{ id: "b", path: rect(150, 20, 100, 80), style: { ...style, pen: inkpen } }, // tapers at both ends
	{ id: "c", path: rect(280, 20, 100, 80), style: { ...style, pen: marker } }, // translucent chisel nib
	{ id: "d", path: rect(410, 20, 100, 80), style: { ...style, pen: gpen } }, // hairline to bold
];
```

<!-- /example -->

`fineliner` is the default pen: a round nib with constant width, rendered as a native stroke. `inkpen` tapers at both ends of a stroke, `marker` is a translucent chisel nib whose overlapping strokes get darker, and `gpen` is a flexible comic-inking nib that goes from hairline to bold with pressure. Change a pen's options with its factory, such as `createGPen({ pressure: 0.5 })`; pressure strength runs from 0 (constant width) to 1.

### Hands

![The same shapes drawn with four hands](https://raw.githubusercontent.com/VOD-Studio/violet/release/2.0/web/packages/inkline/docs/images/hands.svg)

<!-- example: hands -->

```ts
const style = styles.natural;
const items: SceneItem[] = [
	{ id: "a", path: rect(20, 20, 100, 80), fillRole: "card", style: styles.neat },
	{ id: "b", path: rect(150, 20, 100, 80), fillRole: "card", style: styles.natural },
	{ id: "c", path: rect(280, 20, 100, 80), fillRole: "card", style: styles.draft }, // every stroke twice
	{
		id: "d",
		path: rect(410, 20, 100, 80),
		fillRole: "card",
		style: { ...style, hand: hands.inking },
	},
];
```

<!-- /example -->

A hand turns geometry into strokes. From left to right: `neat` and `natural` suit diagrams and interfaces, `draft` draws every stroke twice like a quick sketch, and `inking` lifts the pen at corners and crosses the lines, like comic line art. `createHand` builds a hand with your own settings.

### Fills

![Eight fills](https://raw.githubusercontent.com/VOD-Studio/violet/release/2.0/web/packages/inkline/docs/images/fills.svg)

<!-- example: fills -->

```ts
const style = styles.natural;
const items: SceneItem[] = [
	{
		id: "a",
		path: rect(20, 20, 100, 80),
		fillRole: "sky",
		style: { ...style, fill: fills.hachure },
	},
	{
		id: "b",
		path: rect(150, 20, 100, 80),
		fillRole: "rose",
		style: { ...style, fill: fills["cross-hatch"] },
	},
	{
		id: "c",
		path: rect(280, 20, 100, 80),
		fillRole: "mint",
		style: { ...style, fill: fills.dots },
	},
	{
		id: "d",
		path: rect(410, 20, 100, 80),
		fillRole: "sun",
		style: { ...style, fill: fills.solid },
	},
	{
		id: "e",
		path: rect(20, 130, 100, 80),
		fillRole: "sky",
		style: { ...style, fill: createPatternFill("hachure", { gap: 10, angle: 60 }) }, // wider gap, steeper lines
	},
	{
		id: "f",
		path: rect(150, 130, 100, 80),
		fillRole: "rose",
		style: { ...style, fill: fills.zigzag },
	},
	{
		id: "g",
		path: rect(280, 130, 100, 80),
		fillRole: "mint",
		style: { ...style, fill: fills.dashed },
	},
	{ id: "h", path: rect(410, 130, 100, 80), fillRole: "sun", style: lineWashStyle }, // wash
];
```

<!-- /example -->

`fills` has `hachure`, `cross-hatch`, `zigzag`, `zigzag-line`, `dashed`, `dots` and `solid`; `createPatternFill` changes a pattern's spacing and angle, and `createWashFill` is the watercolor-like wash. Pattern lines are drawn by the same hand and pen as outlines, and holes stay empty under both `evenodd` and `nonzero` fill rules.

### Line and wash

![A house and sun in line-and-wash style](https://raw.githubusercontent.com/VOD-Studio/violet/release/2.0/web/packages/inkline/docs/images/line-wash.svg)

<!-- example: line-wash -->

```ts
const style = lineWashStyle;
const items: SceneItem[] = [
	{ id: "hill", path: pathFromSvg("M0 230C120 180 260 190 400 236V280H0Z"), fillRole: "grass" },
	{ id: "sun", path: circle(330, 70, 34), fillRole: "sun" },
	{ id: "wall", path: rect(110, 140, 140, 96), fillRole: "wall" },
	{
		id: "roof",
		path: polygon([
			[94, 146],
			[180, 80],
			[266, 146],
		]),
		fillRole: "roof",
	},
	{ id: "door", path: rect(134, 176, 36, 60, 4), fillRole: "door" },
	{ id: "window", path: rect(192, 168, 38, 34), fillRole: "glass" },
];
```

<!-- /example -->

`lineWashStyle` combines the inking hand, the G pen and the wash fill. Give each shape one base color: the wash shifts away from the light, leaves a paper-white edge on the lit side and adds short hatching in the shadow of larger shapes.

### Diagrams

![A flowchart drawn with the G pen and the draft hand](https://raw.githubusercontent.com/VOD-Studio/violet/release/2.0/web/packages/inkline/docs/images/diagram.svg)

<!-- example: diagram -->

```ts
const style = { ...styles.draft, pen: gpen };
const items: SceneItem[] = [
	{
		id: "draft",
		path: rect(20, 30, 120, 50, 8),
		fillRole: "sky",
		label: { text: "Draft", x: 80, y: 55 },
	},
	{
		id: "review",
		path: polygon([
			[270, 10],
			[340, 55],
			[270, 100],
			[200, 55],
		]),
		fillRole: "lilac",
		label: { text: "Review?", x: 270, y: 55 },
	},
	{ id: "edge", path: line(140, 55, 200, 55), pinEnds: true }, // ends stay on the node edges
	{
		id: "head",
		path: polygon([
			[200, 55],
			[189, 50],
			[189, 60],
		]),
		fillRole: "ink",
		strokeRole: "none",
		style: { ...style, fill: fills.solid },
	},
];
```

<!-- /example -->

Lay out nodes and edges with any engine, such as Mermaid's SVG output or your own layout, then pass in the geometry. A `label` is drawn as text centered on the given point, and `pinEnds: true` keeps a connector's endpoints exactly where you put them so arrowheads line up.

### Ink vector artwork

The original coffee-girl illustration at the top of this page is the output of `inkArtwork` below, given the artwork as color-region paths, ink-area paths and traced centerlines with their widths. The renderer takes plain JSON data and does not depend on an application or framework.

<!-- example: artwork -->

```ts
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
```

<!-- /example -->

### Animation

Animation needs a DOM, so this example has no image.

<!-- example: animation -->

```ts
import { createPlayer, createSchedule, draw, rect, styles } from "@violetjs/inkline";
import { mountSvg, seekSvg } from "@violetjs/inkline/svg";

/** Call in a browser; cancel the returned player when removing the host. */
export function animateCard(host: HTMLElement) {
	const drawing = draw(
		{ width: 240, height: 150, items: [{ id: "card", path: rect(20, 20, 200, 110, 12) }] },
		{ style: styles.natural, seed: 35 },
	);
	const palette = { paper: "#fffdf7", ink: "#252332" };
	const schedule = createSchedule(drawing, { mode: "stagger" });
	const svg = mountSvg(drawing, palette, { schedule });
	host.append(svg);
	const player = createPlayer({
		duration: schedule.duration,
		onFrame: (time) => seekSvg(svg, time),
	});
	player.play();
	return player;
}
```

<!-- /example -->

Strokes are revealed along their path, variable-width strokes grow from the start, and fills fade in. Animation only changes what is visible and never redraws. On a canvas, call `drawCanvas(drawing, canvas, palette, { schedule, time })` on every frame.

## API

The [API reference](https://github.com/VOD-Studio/violet/blob/release/2.0/web/packages/inkline/docs/api.md) documents every export and option. The main entry points are:

| Import | Exports |
| --- | --- |
| `@violetjs/inkline` | `draw`, geometry (`rect`, `circle`, `ellipse`, `line`, `polyline`, `polygon`, `curve`, `arc`, `pathFromSvg`), styles, hands, pens, fills, animation timing, and the extension API |
| `@violetjs/inkline/svg` | `renderSvg`, `mountSvg`, `seekSvg`, `updateSvgPalette`, `pathData` |
| `@violetjs/inkline/canvas` | `drawCanvas` |

## Requirements

- ES2022 and native ES modules: browsers released in 2022 or later, or Node.js 18 or later for `renderSvg`.
- `mountSvg`, `seekSvg` and `drawCanvas` need a browser DOM.
- TypeScript 5 or later for the bundled type definitions.

## License

[MIT](https://github.com/VOD-Studio/violet/blob/release/2.0/web/packages/inkline/LICENSE)

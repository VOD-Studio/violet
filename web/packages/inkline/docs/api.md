# API reference

English | [简体中文](./api.zh-CN.md)

- [Drawing](#drawing): `draw`, `Scene`, `SceneItem`, `DrawOptions`, `Drawing`, `BudgetExceeded`
- [Geometry](#geometry): `rect`, `circle`, `ellipse`, `line`, `polyline`, `polygon`, `curve`, `arc`, `pathFromSvg`, `PathBuilder`
- [Styles](#styles): `Style`, `styles`, `lineWashStyle`
- [Hands](#hands): `hands`, `fillHands`, `createHand`
- [Pens](#pens): `fineliner`, `inkpen`, `gpen`, `marker`, their factories, `createRibbonPen`
- [Fills](#fills): `fills`, `createPatternFill`, `createWashFill`
- [Rendering](#rendering): `renderSvg`, `mountSvg`, `seekSvg`, `updateSvgPalette`, `pathData`, `drawCanvas`
- [Existing SVG](#existing-svg): `inkSvg`
- [Animation](#animation): `createSchedule`, `itemProgress`, `createPlayer`
- [Extension API](#extension-api): `Hand`, `Pen`, `Fill`, `DrawContext`, `BatchBuilder` and helpers

All coordinates are in scene units. Unless stated otherwise, "width" means the nominal line width of an item.

## Drawing

### `draw(scene, options): Drawing`

Generates the strokes and fills for every item of a scene. The result holds no DOM objects and can be rendered any number of times, with different palettes and renderers.

```ts
import { circle, draw, styles } from "@violetjs/inkline";

const drawing = draw(
  { width: 200, height: 200, items: [{ id: "sun", path: circle(100, 100, 60), fillRole: "sun" }] },
  { style: styles.natural, seed: 7 },
);
```

Randomness is derived from `seed`, the item `id` and an internal channel, so the same input and seed always produce identical output, and changing one item never changes another.

#### `Scene`

| Field | Type | Description |
| --- | --- | --- |
| `width`, `height` | `number` | Size of the scene, used as the SVG `viewBox`. |
| `items` | `SceneItem[]` | Items in paint order: later items are drawn on top. |

#### `SceneItem`

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `id` | `string` | | Unique and stable within the scene. Together with the seed it decides the item's randomness. |
| `path` | `Path` | | Geometry to draw. Build it with the [geometry](#geometry) functions. |
| `style` | `Style` | `options.style` | Style for this item only. |
| `fillRole` | `string` | none | Palette role for the fill. Items without it are not filled. Only closed subpaths are filled. |
| `strokeRole` | `string` | `"ink"` | Palette role for the outline. `"none"` draws no outline. |
| `lineWidth` | `number` | `options.width` | Nominal line width for this item. |
| `pinEnds` | `boolean` | `false` | Keeps both ends of open paths exactly in place, for connectors and arrow anchors. |
| `transform` | `[a, b, c, d, e, f]` | none | Affine matrix applied when rendering, in SVG `matrix()` order. |
| `label` | `{ text, x, y, size? }` | none | Text centered at `(x, y)`, in the item's coordinates. `size` defaults to 14. Labels are not laid out or wrapped. |

#### `DrawOptions`

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `style` | `Style` | required | Default style for items without their own. |
| `seed` | `number` | `1` | Any integer, including 0. |
| `width` | `number` | `2` | Default nominal line width. |
| `precision` | `number` | `0.25` | Tolerance for flattening curves and simplifying outlines. |
| `pixelScale` | `number` | `1` | CSS pixels per scene unit. Hand options given in CSS pixels, such as `maxStroke` and `segment`, are converted with it. |
| `maxVertices` | `number` | `2000000` | Limit on output vertices for the whole scene. |
| `maxStrokes` | `number` | `200000` | Limit on strokes for the whole scene. |

#### `Drawing`

| Field | Type | Description |
| --- | --- | --- |
| `width`, `height` | `number` | Copied from the scene. |
| `items` | `DrawnItem[]` | One per scene item: `id`, `batches` (render batches, fills below outlines), `duration` (natural drawing time in arc-length units), `transform` and `label`. |
| `seed` | `number` | Seed used. |
| `budget` | `{ vertices, strokes }` | Output size. |
| `generateMs` | `number` | Generation time in milliseconds. |

#### `BudgetExceeded`

Thrown by `draw` when the output would exceed `maxVertices` or `maxStrokes`. It has `kind` (`"vertices"` or `"strokes"`), `actual` and `limit`. `draw` never returns a partial drawing and never lowers detail on its own.

## Geometry

Every function returns an immutable `Path`: absolute `M`, `L`, `C` and `Z` commands, with quadratic curves and arcs converted to cubic Béziers. Treat paths as values; generated geometry is cached by object identity.

| Function | Description |
| --- | --- |
| `rect(x, y, width, height, radius = 0)` | Rectangle, with rounded corners when `radius` is greater than 0. |
| `circle(cx, cy, r)` | Circle. |
| `ellipse(cx, cy, rx, ry)` | Axis-aligned ellipse. |
| `line(x1, y1, x2, y2)` | Straight line. |
| `polyline(points, closed = false)` | Line through `[x, y]` points. |
| `polygon(points)` | Closed polygon. |
| `curve(points)` | Smooth open curve through the points (centripetal Catmull-Rom). |
| `arc(cx, cy, rx, ry, start, end, closed = "none")` | Elliptical arc between angles in radians. `closed` is `"none"`, `"chord"` or `"pie"`. |
| `pathFromSvg(d, fillRule = "nonzero")` | Parses SVG path data, including relative commands and arcs. |
| `transformPath(path, [a, b, c, d, e, f])` | Applies an affine matrix. |
| `mergePaths(paths, fillRule)` | Combines the subpaths of several paths into one path. |
| `createPath(verbs, coords, fillRule = "nonzero")` | Builds a path from raw arrays. Verbs: `MOVE` 0, `LINE` 1, `CUBIC` 2, `CLOSE` 3. |

`new PathBuilder()` builds paths incrementally with `moveTo`, `lineTo`, `quadTo`, `cubicTo`, `close` and `build(fillRule)`.

`Path` has `verbs` (`Uint8Array`), `coords` (`Float64Array`), `fillRule` (`"nonzero"` or `"evenodd"`) and `bounds` (`{ x, y, width, height }`, estimated from control points).

## Styles

A style combines a hand, a pen and a fill.

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `hand` | `Hand` | required | Draws the outlines. |
| `pen` | `Pen` | required | Inks the outlines. |
| `fill` | `Fill` | solid | Fills the items that have a `fillRole`. |
| `fillHand` | `Hand` | `hand` | Draws pattern lines. |
| `fillPen` | `Pen` | `pen` | Inks pattern lines. |
| `fillWeight` | `number` | `0.5` | Width of pattern lines relative to the item's width. |
| `lineRole` | `(fillRole) => string` | `"ink"` | Picks the outline role from the fill role when an item has no `strokeRole`. |

Styles are plain objects, so extend them with spread syntax: `{ ...styles.natural, pen: gpen, fill: fills.dots }`.

| Preset | Contents |
| --- | --- |
| `styles.neat` | Neat hand, fineliner, solid fill. |
| `styles.natural` | Natural hand, fineliner, solid fill. |
| `styles.draft` | Draft hand (every stroke drawn twice), fineliner, solid fill. |
| `lineWashStyle` | Inking hand, G pen and wash fill, with pattern lines at 0.55× width. |

`lineWashStyle` is a separate export rather than part of `styles`, so that bundles which do not use it do not include the G pen and the wash fill.

## Hands

`hands.neat`, `hands.natural`, `hands.draft` and `hands.inking` draw outlines. `fillHands` has the same four keys with calmer settings for pattern lines: no broken corners, no overshoot and no retracing.

### `createHand(options?, id = "hand"): Hand`

Creates a hand. Options not given take the values of `hands.natural`.

| Option | Default | Description |
| --- | --- | --- |
| `roughness` | `0.9` | Amplitude of the slow sideways wobble, in scene units. Scaled down on short strokes. |
| `bowing` | `1` | How far each straight run bows, as a multiplier. |
| `breakChance` | `0.3` | Probability, from 0 to 1, of lifting the pen at a corner. |
| `overshoot` | `1` | How far strokes overshoot where they break at a corner, as a multiplier. 0 disables overshoot. |
| `overshootLimit` | `2` | Maximum overshoot, in line widths. |
| `overlap` | `[0.04, 0.1]` | How far a closed curve's last stroke runs past its start, as a fraction of the perimeter. |
| `maxStroke` | `360` | Longest single stroke, in CSS pixels. Longer runs are split into equal strokes. |
| `segment` | none | `[min, max]` length of strokes in CSS pixels. When set, long lines are drawn as several strokes of random length instead of being split evenly. |
| `gap` | `[0, 0]` | `[min, max]` gap between those strokes, in line widths. Negative values make strokes overlap. |
| `passes` | `1` | Number of times each stroke is drawn. 2 gives the draft look. |
| `taper` | `10` | Length over which pressure ramps up and down at each end, in line widths. |
| `taperShare` | `0.45` | Maximum share of a stroke's length used by each ramp, so short strokes keep a solid body. |
| `tip` | `0.25` | Pressure at both ends, from 0 to 1. Pressure in the middle of a stroke is 1. |
| `pressureNoise` | `0.1` | Amplitude of random pressure variation along a stroke. |

| Preset | Overrides |
| --- | --- |
| `neat` | `roughness: 0.35, bowing: 0.4, breakChance: 0.15, overshoot: 0.4` |
| `natural` | none |
| `draft` | `roughness: 1.8, bowing: 1.6, breakChance: 0.6, overshoot: 1.5, passes: 2` |
| `inking` | `roughness: 0.4, bowing: 0.5, breakChance: 0.8, overshoot: 2.2, overshootLimit: 6, overlap: [-0.04, 0.03], segment: [45, 160], gap: [-1, 3.5], taper: 9, taperShare: 0.22, tip: 0, pressureNoise: 0.16` |

## Pens

Each built-in pen is available as a default instance and as a factory. Every factory accepts `pressure`, the pressure strength from 0 (constant width) to 1 (the pen's full pressure curve), and a pen reports its current strength in `pen.pressure`.

| Instance | Factory and options |
| --- | --- |
| `fineliner` | `createFineliner({ weight = 1, pressure = 0, retraceWeight = 0.75, retraceOpacity = 0.7 })`. With `pressure` 0 it renders native constant-width strokes; above 0 width varies between `1 − pressure` and 1. |
| `inkpen` | `createInkPen({ weight = 1.6, pressure = 0.92 })`. `weight` is the width under full pressure, relative to the nominal width. |
| `gpen` | `createGPen({ weight = 0.75, pressure = 0.95 })`. At common pressure the body is about the nominal width; under full pressure about 1.2×. |
| `marker` | `createMarker({ weight = 4, angle = -35, aspect = 0.28, opacity = 0.78, pressure = 0.15 })`. Chisel nib; `angle` in degrees, `aspect` is the short-to-long axis ratio. Each stroke is a separate layer, so overlapping strokes get darker. |

`pens` is an object with all four instances. Importing it includes all four pens in your bundle; import a single pen by name to keep bundles small.

`retraceWeight` and `retraceOpacity` set the width and opacity of the second pass drawn by the draft hand, relative to the first.

### `createRibbonPen(options): Pen`

Creates a variable-width pen that sweeps an elliptical nib along each stroke.

| Option | Default | Description |
| --- | --- | --- |
| `id` | required | Pen name. |
| `weight` | required | Full width of the nib's long axis at pressure 1, relative to the nominal width. |
| `angle` | `0` | Angle of the nib's long axis, in degrees. |
| `aspect` | `1` | Short-to-long axis ratio, from 0 to 1. 1 is a round nib. |
| `minScale`, `maxScale` | required | Width multiplier at pressure 0 and 1 when pressure strength is 1. |
| `gamma` | `1` | Pressure curve exponent: width multiplier is `minScale + (maxScale − minScale) × pressure^gamma`. |
| `pressure` | `1` | Pressure strength. The width multiplier becomes `max(0.02, 1 + strength × (curve − 1))`. |
| `opacity` | `1` | Ink opacity. |
| `layered` | `false` | Puts every stroke in its own layer, so overlaps between strokes get darker. |
| `retraceWeight`, `retraceOpacity` | `0.75`, `0.7` | Width and opacity of draft second passes. |

## Fills

`fills` contains `solid`, `hachure`, `cross-hatch`, `dashed`, `zigzag`, `zigzag-line` and `dots`. `solidFill` is the same as `fills.solid`.

### `createPatternFill(pattern, options?): Fill`

Creates a pattern fill with custom spacing. `pattern` is any key of `fills` except `solid`.

| Option | Default | Description |
| --- | --- | --- |
| `gap` | `max(8 × fill line width, 5)` | Distance between pattern lines. |
| `angle` | `-41` | Angle of the lines, in degrees. |

### `createWashFill(options?): Fill`

Creates a watercolor-like wash. The flat color is shifted away from the light and clipped to the shape, which leaves a paper-white edge of varying width on the lit side. Shapes thicker than 20 units also get short hatching along the shadow side. Highlight and hatching scale with the shape's thickness (2 × area ÷ perimeter), so long thin shapes are not swallowed by the highlight.

| Option | Default | Description |
| --- | --- | --- |
| `light` | `[-0.55, -0.83]` | Direction towards the light, in scene coordinates with y pointing down. |
| `highlight` | `0.1` | Average width of the paper-white edge, relative to thickness, at most 7 units. 0 fills edge to edge. |
| `bleed` | `0.9` | How much the edge of the color wavers, relative to the highlight width. |
| `opacity` | `1` | Opacity of the color. Below 1, shapes behind show through. |
| `hatch` | `0.35` | Width of the hatched band on the shadow side, relative to thickness. 0 disables hatching. |
| `hatchGap` | `2.6` | Distance between hatch lines, in fill line widths. |
| `hatchAngle` | `58` | Angle of the hatch lines, in degrees. |
| `hatchRole` | `"ink"` | Palette role of the hatch lines. |

## Rendering

A `Palette` maps every role used by a drawing to a CSS color, for example `{ paper: "#fff", ink: "#222", sky: "#9fc9e8" }`. Rendering throws if a role is missing, instead of guessing a color.

All renderers accept these shared options:

| Option | Default | Description |
| --- | --- | --- |
| `background` | `"paper"` | Palette role of the background, or `false` for a transparent background. |
| `fontFamily` | `"system-ui, sans-serif"` | Font for labels. |

### `renderSvg(drawing, palette, options?): string`

Returns standalone SVG markup with one `<path>` per render batch. It does not need a DOM, so it works in Node.js and Web Workers.

| Option | Default | Description |
| --- | --- | --- |
| `decimals` | `2` | Decimal places for coordinates. |
| `idPrefix` | `"inkline"` | Prefix for internal `clipPath` ids. A counter is appended so that several drawings can share a page. |
| `title` | none | Accessible name, written as `<title>`. |

### `mountSvg(drawing, palette, options?): SVGSVGElement`

Builds an SVG element with the same options as `renderSvg`. Pass `schedule` (see [Animation](#animation)) to split strokes into separately animatable elements; the drawing stays complete until you call `seekSvg`. Requires a browser DOM.

### `seekSvg(svg, time)`

Shows a mounted, scheduled SVG at `time` seconds: finished strokes are complete, strokes in progress show the part drawn so far, and later strokes are hidden. Seeking, pausing and reversing never regenerate strokes.

### `updateSvgPalette(svg, palette)`

Recolors an SVG produced by `mountSvg` without changing its geometry.

### `pathData(verbs, coords, decimals = 2): string`

Serializes path commands to SVG path data.

### `drawCanvas(drawing, canvas, palette, options?)`

From `@violetjs/inkline/canvas`. Paints the drawing onto a canvas, sizing the backing store to the canvas's CSS size times `devicePixelRatio`. Pass `schedule` and `time` to paint a frame of the animation.

## Existing SVG

### `inkSvg(svg, options?)`

From `@violetjs/inkline/dom`. Redraws an SVG that is already attached to the page, such as Mermaid, Graphviz or D3 output, in place: every visible shape (`rect`, `circle`, `ellipse`, `line`, `polyline`, `polygon`, `path`) is replaced by inkline strokes and fills, while layout, text, images, arrow markers and colors are kept. Requires a browser DOM, because it reads computed styles and sizes.

```ts
import mermaid from "mermaid";
import { gpen, styles } from "@violetjs/inkline";
import { inkSvg } from "@violetjs/inkline/dom";

const { svg } = await mermaid.render("flow", "flowchart LR; A --> B");
host.innerHTML = svg;
inkSvg(host.querySelector("svg") as SVGSVGElement, { style: { ...styles.draft, pen: gpen } });
```

| Option | Default | Description |
| --- | --- | --- |
| `style` | `styles.natural` | Style used to draw the shapes. |
| `seed` | `1` | The same SVG and seed always give the same strokes, so re-rendering or switching themes does not make them jump. |
| `minWidth` | `1.6` | Thinner strokes in the SVG are drawn at this nominal width. |
| `thickPen` | `style.pen` | Pen for lines 4 units wide or more, such as git branches or mind-map edges. Pens that taper strongly turn short thick lines into spindles; a pen with low pressure, such as `createGPen({ pressure: 0.25 })`, keeps them solid. |

- Colors, opacity, fill rules, transforms, filters and clip paths come from the SVG's computed styles, so dark themes work unchanged.
- Dashed strokes are drawn with the fineliner so that `stroke-dasharray` still applies; variable-width pens are filled outlines and cannot be dashed.
- Shapes with only a fill get an outline in their fill color. Rectangles that tightly back a text label keep their fill and get no outline.
- Arrow markers and `textPath` references move to an invisible copy of the original path, so arrowheads and curved labels stay exact.
- Mermaid's classic-look node shapes that its built-in Rough.js draws as a fill plus a doubled outline are merged into one closed shape.
- Converted shapes are marked with `data-inkline`; calling `inkSvg` again on the same SVG skips them instead of drawing a second layer.

## Animation

### `createSchedule(drawing, options?): Schedule`

Assigns each item a time window. Windows depend only on each item's natural drawing time and never change the strokes.

| Option | Default | Description |
| --- | --- | --- |
| `mode` | `"sequential"` | `"sequential"`: items one after another. `"parallel"`: all items start and end together. `"stagger"`: items start one after another and overlap. |
| `speed` | `600` | Drawing speed, in scene units per second. |
| `itemRange` | `[0.12, 2.5]` | Shortest and longest time for one item, in seconds. |
| `gap` | derived | Delay between item starts in `"stagger"` mode, in seconds. By default the whole drawing takes at most 6 seconds. |

A `Schedule` has `mode`, `duration` in seconds, and `start` and `end` arrays indexed like `drawing.items`.

`itemProgress(schedule, index, time)` returns an item's progress at `time`, from 0 to 1.

### `createPlayer(options): Player`

A clock for playing a schedule. It owns no strokes; it only calls `onFrame` with the current time.

| Option | Default | Description |
| --- | --- | --- |
| `duration` | required | Total time, in seconds. |
| `onFrame(time)` | required | Called after every time change. |
| `onEnd()` | none | Called once when playback reaches the end on its own. Cancelling, restarting or seeking invalidates a pending call. |
| `rate` | `1` | Playback speed multiplier. |
| `raf`, `cancelRaf` | `requestAnimationFrame` | Frame scheduler, replaceable for tests and other environments. |
| `now` | `performance.now` | Clock in milliseconds. |

A `Player` has `time`, `playing` and a writable `rate`, and the methods `play()` (restarts from 0 when at the end), `pause()`, `seek(time)` (clamped, keeps the playing state), `restart()` and `cancel()`.

## Extension API

Hands, pens and fills are plain objects. Put your own in a style; there is nothing to register.

```ts
interface Hand {
  id: string;
  strokes(skeleton: Skeleton, ctx: DrawContext): readonly Stroke[];
}

interface Pen {
  id: string;
  pressure?: number; // current pressure strength; omit if the pen ignores pressure
  ink(strokes: readonly Stroke[], ctx: DrawContext, role: string): readonly InkBatch[];
}

interface Fill {
  id: string;
  generate(region: Skeleton, ctx: DrawContext, source: Path): {
    areas?: readonly Area[]; // { path, role?, opacity?, clip?: boolean | Path }
    guides?: Skeleton; // pattern lines, drawn by fillHand and inked by fillPen
    guideRole?: string;
  };
}
```

- A `Skeleton` is a flattened path: `contours` (each with `points`, cumulative `arc` length, `corners`, `closed` and `length`) and `fillRule`.
- A `Stroke` has `points` as `[x, y, pressure, time] × n`, `curve` (points are Catmull-Rom control points when true), `closed` and `pass` (0 for the first pass, more for draft retraces).
- `DrawContext` provides `width`, `precision`, `pixelScale`, `pinEnds`, `fillRole`, `flatten(path)`, and the random source `random(channel, index)` (0 to 1) and `noise(channel, x)` (about −1 to 1).
- Create channel ids once with `channel("my-pen:width")`. Take all randomness from `ctx.random` and `ctx.noise` to keep output deterministic.
- `new BatchBuilder({ mode, role, width?, opacity?, fillRule? })` collects geometry into an `InkBatch` with `stroke(stroke)`, `ribbon(ribbon, t0, t1)` and `path(path, t0, t1)`; check `empty`, then call `build()`. Return new batches from `Pen.ink`; the generator takes ownership and normalizes their timing.
- Pens that keep a factory signature of `(options?: { pressure?: number }) => Pen` (`PenFactory`) can be adjusted like the built-in pens.

Lower-level helpers used by the built-in implementations are also exported: `flatten(path, precision)`, `pointAt(contour, distance, out)`, `polylineContour(points, closed)`, `catmullRomToCubics(values, stride, emit)`, `strokeRibbon(stroke, options)`, `minimumJerk(t)`, `createRandom(seed, key)` and `hashString(text)`.

### Data and helper contracts

All these names are exported from the root entry unless an entry is explicitly given.

| Type / helper | Contract |
| --- | --- |
| `Bounds`, `Matrix`, `Label`, `Budget` | `{ x, y, width, height }`; readonly `[a,b,c,d,e,f]`; `{ text, x, y, size? }`; readonly `{ vertices, strokes }`, respectively. |
| `Contour` | Readonly `points: Float64Array` (interleaved x/y, no duplicate closing point), `arc: Float64Array`, `corners: Uint32Array`, `closed: boolean`, `length: number`. Closed length includes the final edge. |
| `Stroke` | Readonly `points: Float32Array` (x/y/pressure/time), `curve`, `closed`, `pass`. |
| `Area`, `FillOutput` | An area is `{ path, role?, opacity?, clip? }`. `clip: true` uses the source path; a `Path` supplies its own clip. `FillOutput` has optional readonly `areas`, `guides: Skeleton`, and `guideRole`. Omitted roles use the item's fill role. |
| `InkBatch` | Readonly `mode: "stroke" \| "fill"`, `role`, optional `width` (1), `opacity` (1), `fillRule`, `clip: Path`; `verbs: Uint8Array`, `coords: Float32Array`, `spans: Float32Array` (t0/t1 per subpath), optional `ribbons: Uint32Array` (n/c per subpath, 0/0 for non-ribbons). |
| `RandomSource` | `random(channel, integerIndex): number` returns `[0,1)` independently of call order. `noise(channel, x)` returns continuous gradient noise, approximately `[-1,1]`, zero at integer lattice points. `scope(salt: number): RandomSource` derives an independent scope. `DrawContext` also exposes `scope`. |
| `createRandom(seed: number, key: number): RandomSource` | Creates a deterministic source; use `hashString(text): number` for a string scope key. `channel(name): number` hashes a channel name once. |
| `flatten(path, precision): Skeleton` | Flattens curves and detects corners; caches by path identity and tolerance. Do not mutate paths or returned geometry. |
| `polylineContour(xy: ArrayLike<number>, closed = false): Contour` | Takes interleaved x/y, not tuples. Throws `RangeError` if no point is available. |
| `pointAt(contour, distance, out: Float64Array): void` | Writes `[x,y,tangentX,tangentY]` into an output array of length ≥4. Distance wraps on closed contours and clamps on open ones. |
| `catmullRomToCubics(values, stride, emit): void` | Takes interleaved coordinates with x/y first in each stride. Calls `emit(cubic: Float64Array, segment: number)` with `[c1x,c1y,c2x,c2y,x,y]`. The buffer is reused: consume or copy inside the callback. Fewer than two points emit nothing. |
| `minimumJerk(t): number` | `10t³ − 15t⁴ + 6t⁵`; use t in `[0,1]` for a smooth 0-to-1 motion. |
| `Nib` | `{ angle: number, aspect: number }`: angle in **radians**, aspect in `(0,1]`. The higher-level pen factories instead take degrees. |
| `RibbonOptions` | Required `width`, `nib: Nib`, `minScale`, `maxScale`, `gamma`, `precision`. Width is the full nib width in scene units. |
| `strokeRibbon(stroke, options): Ribbon` | Sweeps the nib into a polygon. `Ribbon` has readonly `points: Float32Array`, `n`, `c`: left n points, end-cap c points, right n points in reverse, start-cap c points. |
| `SvgOptions` (`/svg`) | Shared `RenderOptions` plus `decimals`, `idPrefix`, `title`, and `schedule`. Only `mountSvg` uses `schedule`; `renderSvg` always returns the complete drawing. |
| `CanvasOptions` (`/canvas`) | Shared `RenderOptions` plus `schedule` and `time` (seconds, defaults to the schedule duration). |

`PathBuilder.moveTo(x,y)`, `.lineTo(x,y)`, `.quadTo(cx,cy,x,y)`, `.cubicTo(c1x,c1y,c2x,c2y,x,y)` and `.close()` return the builder; `.build(fillRule = "nonzero")` returns a `Path`. `createPath` accepts `Uint8Array` verbs and `Float64Array` coordinates and retains those arrays, so callers must not mutate them.

Option types are exported alongside their factories: `HandOptions`, `PenOptions`, `FinelinerOptions`, `InkPenOptions`, `GPenOptions`, `MarkerOptions`, `RibbonPenOptions`, `PatternOptions`, `WashOptions`, `ScheduleOptions`, `PlayerOptions`. Their fields and defaults are listed in the corresponding sections above. `ScheduleMode` is `"sequential" | "parallel" | "stagger"`. `Palette` and `RenderOptions` are root exports; `SvgOptions` and `CanvasOptions` belong to their renderer entry points.

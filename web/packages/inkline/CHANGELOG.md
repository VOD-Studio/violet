# Changelog

All notable changes to `@violetjs/inkline` are documented here. Versions follow [Semantic Versioning](https://semver.org/); before 1.0.0, a minor version may include breaking changes.

## 0.3.0 - Unreleased

### Added

- `@violetjs/inkline/export` renders a schedule offline, frame by frame, into a GIF with `exportGif` or a WebM video with `exportWebm`. Both take a width, frame rate, length (`duration` scales the whole schedule), final-frame hold, progress callback and `AbortSignal`; GIF adds a loop count and WebM a bitrate. `canExportWebm` reports whether the browser can encode WebM.
- GIF export keeps every palette color exact and spends the remaining colors on anti-aliased edges, overlaps and wash. After the first frame only changed regions are stored, and identical frames are merged.
- WebM export encodes VP9 through WebCodecs, falling back to VP8.

### Fixed

- WebM exports retain every requested frame up to 60 fps instead of applying GIF-specific short-frame merging, preserving the frame cadence and two-second keyframe interval.

## 0.2.0 - 2026-10-11

First public release.

### Added

- `draw` turns a scene of shapes into deterministic hand-drawn ink; the same input and seed always produce the same output.
- Geometry helpers: `rect`, `circle`, `ellipse`, `line`, `polyline`, `polygon`, `curve`, `arc` and `pathFromSvg`.
- Hands: `neat`, `natural`, `draft` and `inking`, plus `createHand` for custom parameters.
- Pens with adjustable pressure: `fineliner`, `inkpen`, `marker` and `gpen`, plus `createRibbonPen` for custom variable-width pens.
- Fills: `hachure`, `cross-hatch`, `zigzag`, `zigzag-line`, `dashed`, `dots`, `solid` and the watercolor-like `createWashFill`.
- `lineWashStyle`, combining the inking hand, the G pen and the wash fill.
- SVG rendering with `renderSvg`, `mountSvg`, `updateSvgPalette` and `seekSvg`; Canvas rendering with `drawCanvas`.
- Draw-on animation with `createSchedule` and `createPlayer`.
- `inkSvg` from `@violetjs/inkline/dom` redraws an SVG already on the page, such as Mermaid, Graphviz or D3 output, keeping its layout, text, markers and colors.
- English and Simplified Chinese guides and API references, with runnable examples and matching vector illustrations.
- Public ESM entry points with TypeScript declarations for Node.js and browser bundlers.

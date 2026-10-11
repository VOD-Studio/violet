# Changelog

All notable changes to `@violetjs/inkline` are documented here. Versions follow [Semantic Versioning](https://semver.org/); before 1.0.0, a minor version may include breaking changes.

## 0.2.0 - Unreleased

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

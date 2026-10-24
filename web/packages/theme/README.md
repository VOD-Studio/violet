# @violetjs/theme

[中文](./README.zh-CN.md)

Turn one seed color into 12-step brand and neutral color scales for light and dark appearances. Text, solid foregrounds and control boundaries meet WCAG 2.2 AA and APCA thresholds for any seed, every color stays inside sRGB, and the same input always gives the same output. Zero dependencies, no Node APIs: it runs in the browser, during SSR and in build scripts.

```sh
pnpm add @violetjs/theme
```

## Usage

The package exports three functions.

```ts
import { generateScales, normalizeTheme, toCssVariables } from "@violetjs/theme";

// 1. Normalize untrusted input (a cookie, a form field). Invalid input falls back to a default theme.
const theme = normalizeTheme({ version: 1, seed: "#3A7BD5" });
// { version: 1, seed: "#3a7bd5", knobs: { neutralChroma: 0.015 } }

// 2. Generate the scales for one appearance.
const light = generateScales(theme, { appearance: "light" });
const dark = generateScales(theme, { appearance: "dark" });
light.brand.steps[9]; // "oklch(…)": the solid brand color
light.brand.contrast; // text color for steps 9 and 10

// 3. Serialize to CSS custom properties.
const css = toCssVariables([light, dark]);
// :root {
// 	--brand-1: light-dark(oklch(…), oklch(…));
// 	…
// 	--brand-contrast: light-dark(oklch(…), oklch(…));
// 	--neutral-1: light-dark(oklch(…), oklch(…));
// 	…
// }
```

With both appearances, each value is a `light-dark()` pair, so the page needs `color-scheme: light` or `color-scheme: dark` (for example `:root { color-scheme: light } .dark { color-scheme: dark }`). Pass a single result to get plain values. `toCssVariables(scales, { selector, prefix })` changes the selector (default `:root`) and the variable prefix (`prefix: "v-"` gives `--v-brand-1`).

## Theme

| Field | Meaning |
| --- | --- |
| `version` | Data version, currently `1`. Other versions fall back to the default theme. |
| `seed` | `#rgb` or `#rrggbb`. The brand scale keeps its hue and as much of its chroma as possible. |
| `knobs.neutralChroma` | Chroma of the neutral scale's strongest steps, `0`–`0.05`, default `0.015`. Never above the seed's own chroma; `0` gives pure gray. |

`generateScales` throws a `TypeError` for a malformed seed. `normalizeTheme(input, fallback?)` never throws: a non-object, a wrong version or an invalid seed returns the fallback, an invalid knob falls back on its own, and unknown knobs are dropped, so the result is safe to embed in CSS.

## Steps

Step roles follow [Radix Colors](https://www.radix-ui.com/colors/docs/palette-composition/understanding-the-scale). In both appearances, steps 1–8 and 11–12 move away from the background monotonically, while the solid steps 9–10 follow the seed, as Radix's step 9 does.

| Step | Use | Guarantee against steps 1–2 of both scales |
| --- | --- | --- |
| 1–2 | App background, surfaces | |
| 3–5 | Component backgrounds: rest, hover, pressed | |
| 6 | Decorative separators | |
| 7–8 | Control borders, focus rings | WCAG 3:1, APCA Lc 30 |
| 9–10 | Solid backgrounds and their hover | APCA Lc 15, since [WCAG 1.4.11](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast) needs no fill contrast for a button with a text label; `contrast` on them: WCAG 4.5:1, APCA Lc 60 |
| 11 | Secondary text, links | WCAG 4.5:1, APCA Lc 75 |
| 12 | Body text | WCAG 4.5:1, APCA Lc 90 |

Text also holds on the component backgrounds, steps 3–5 of both scales: step 12 at WCAG 4.5:1 and APCA Lc 75, step 11 at WCAG 4.5:1 and APCA Lc 60. The APCA levels follow APCA's use-case tiers: Lc 90 is what its font lookup table asks of 16px/400 body text, Lc 75 is the minimum for body text, Lc 60 for other readable content such as labels and buttons, and Lc 30 for meaningful non-text elements.

Step 9 is the seed itself whenever near-white or near-black text passes on it. Otherwise only its lightness moves, to the nearest value where one of them does. `contrast` is whichever text color needs the smaller move, the same in both appearances: saturated mid-tone seeds keep white text in dark mode too, and bright seeds such as yellow keep their brightness with near-black text. Step 10, the hover state, moves toward higher contrast with that text: darker under white text, lighter under near-black text.

## How it works

Colors are computed in OKLCH. Each step's lightness is solved from a target WCAG contrast ratio against the background (in the spirit of [Adobe Leonardo](https://leonardocolor.io/)). APCA is stricter than WCAG 2 in some ranges, especially in dark mode, so each APCA level is converted into a WCAG ratio target for the solver. Colors outside the target gamut keep their lightness and hue and lose only chroma, as in [CSS Color 4 gamut mapping](https://www.w3.org/TR/css-color-4/#gamut-mapping). The output is rounded to four decimals for lightness and chroma, still inside the gamut.

APCA itself is not part of the runtime. The test suite sweeps every hue in 1° steps across the full chroma range, many seed lightnesses and both ends of the knob range, and checks each pair against the official [`apca-w3`](https://github.com/Myndex/apca-w3) and WCAG 2.2, for both the exact and the 8-bit quantized colors.

## License

MIT. `apca-w3`, whose license limits it to web accessibility use, is only a development dependency of the tests.

# @violetjs/theme

[中文](./README.zh-CN.md)

Turn one seed color into 12-step color scales for light and dark appearances: brand and neutral scales with translucent counterparts, and fixed danger, warning and success scales. Text, solid foregrounds and control boundaries meet WCAG 2.2 AA and APCA thresholds for any seed, a higher-contrast level serves `prefers-contrast: more`, every color stays inside sRGB, and the same input always gives the same output. Zero dependencies, no Node APIs: it runs in the browser, during SSR and in build scripts.

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

// 2. Generate the scales for each appearance, optionally at the higher contrast level.
const light = generateScales(theme, { appearance: "light" });
const dark = generateScales(theme, { appearance: "dark" });
const lightMore = generateScales(theme, { appearance: "light", contrast: "more" });
const darkMore = generateScales(theme, { appearance: "dark", contrast: "more" });
light.brand.steps[9]; // "oklch(…)": the solid brand color
light.brand.contrast; // text color for steps 9 and 10
light.brand.alpha[3]; // "color(srgb … / …)": step 3 as a translucent color over the page background
light.status.danger.steps[11]; // danger text

// 3. Serialize to CSS custom properties.
const css = toCssVariables([light, dark, lightMore, darkMore]);
// :root {
// 	--brand-1: light-dark(oklch(…), oklch(…));
// 	…
// }
// @media (prefers-contrast: more) {
// 	:root { … }
// }
```

With both appearances, each value is a `light-dark()` pair, so the page needs `color-scheme: light` or `color-scheme: dark` (for example `:root { color-scheme: light } .dark { color-scheme: dark }`). Pass a single result to get plain values. Results at the `"more"` contrast level go into a `prefers-contrast: more` media query that overrides the same variables. `toCssVariables(scales, { selector, prefix })` changes the selector (default `:root`) and the variable prefix (`prefix: "v-"` gives `--v-brand-1`).

| Variables | Scale |
| --- | --- |
| `--brand-1` … `--brand-12`, `--brand-contrast`, `--brand-a1` … `--brand-a12` | Brand, from the seed |
| `--neutral-1` … `--neutral-12`, `--neutral-contrast`, `--neutral-a1` … `--neutral-a12` | Neutral, tinted with the seed's hue |
| `--danger-*`, `--warning-*`, `--success-*` | Status, fixed hues |

## Theme

| Field | Meaning |
| --- | --- |
| `version` | Data version, currently `1`. Other versions fall back to the default theme. |
| `seed` | `#rgb` or `#rrggbb`. The brand scale keeps its hue and as much of its chroma as possible. |
| `knobs.neutralChroma` | Chroma of the neutral scale's strongest steps, `0`–`0.05`, default `0.015`. Never above the seed's own chroma; `0` gives pure gray. |

`generateScales` throws a `TypeError` for a malformed seed. `normalizeTheme(input, fallback?)` never throws: a non-object, a wrong version or an invalid seed returns the fallback, an invalid knob falls back on its own, and unknown knobs are dropped, so the result is safe to embed in CSS.

## Steps

Step roles follow [Radix Colors](https://www.radix-ui.com/colors/docs/palette-composition/understanding-the-scale). In both appearances, steps 1–8 and 11–12 move away from the background monotonically, while the solid steps 9–10 follow the seed, as Radix's step 9 does. Every scale meets the same thresholds on the background steps of the brand and neutral scales and on its own.

| Step | Use | Standard level | `"more"` level |
| --- | --- | --- | --- |
| 1–2 | App background, surfaces | | |
| 3–5 | Component backgrounds: rest, hover, pressed | | |
| 6 | Decorative separators | | |
| 7–8 | Control borders, focus rings | WCAG 3:1, APCA Lc 30 | WCAG 4.5:1, Lc 45 |
| 9–10 | Solid backgrounds and their hover | APCA Lc 15 against the background, since [WCAG 1.4.11](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast) needs no fill contrast for a button with a text label; `contrast` on them: WCAG 4.5:1, Lc 60 | Lc 30; `contrast`: WCAG 7:1, Lc 75 |
| 11 | Secondary text, links | WCAG 4.5:1, APCA Lc 75; on steps 3–5: Lc 60 | WCAG 7:1, Lc 90; on steps 3–5: Lc 75 |
| 12 | Body text | WCAG 4.5:1, APCA Lc 90; on steps 3–5: Lc 75 | WCAG 7:1, Lc 100; on steps 3–5: Lc 90 |

The standard APCA levels follow APCA's use-case tiers: Lc 90 is what its font lookup table asks of 16px/400 body text, Lc 75 is the minimum for body text, Lc 60 for other readable content such as labels and buttons, Lc 30 for meaningful non-text elements and Lc 15 for large buttons to be discernible. The `"more"` level adds Lc 15, APCA's equivalent of AAA, with body text capped at Lc 100, the most an off-white background allows, and uses WCAG's AAA 7:1 for text.

Step 9 is the seed itself whenever near-white or near-black text passes on it. Otherwise only its lightness moves, to the nearest value where one of them does. `contrast` is whichever text color needs the smaller move, the same in both appearances: saturated mid-tone seeds keep white text in dark mode too, and bright seeds such as yellow keep their brightness with near-black text. Step 10, the hover state, moves toward higher contrast with that text: darker under white text, lighter under near-black text.

## Status scales

Danger, warning and success have fixed seeds and do not change with the theme. They follow the same rules as the brand scale.

## Alpha scales

`brand.alpha` and `neutral.alpha` are translucent versions of each step. Over the neutral step 1 page background, each looks the same as the solid step, within the just-noticeable difference ΔE<sub>OK</sub> 0.02. Each uses the smallest opacity that keeps the color inside sRGB, and is written as `color(srgb … / α)` because browsers composite in that space.

## How it works

Colors are computed in OKLCH. Each step's lightness is solved from a target WCAG contrast ratio against the background (in the spirit of [Adobe Leonardo](https://leonardocolor.io/)). APCA is stricter than WCAG 2 in some ranges, especially in dark mode, so each APCA level is converted into a WCAG ratio target for the solver. Colors outside the target gamut keep their lightness and hue and lose only chroma, as in [CSS Color 4 gamut mapping](https://www.w3.org/TR/css-color-4/#gamut-mapping). The output is rounded to four decimals for lightness and chroma, still inside the gamut.

APCA itself is not part of the runtime. The test suite sweeps every hue in 1° steps across the full chroma range, many seed lightnesses and both ends of the knob range, in both appearances and both contrast levels, and checks each pair against the official [`apca-w3`](https://github.com/Myndex/apca-w3) and WCAG 2.2, for both the exact and the 8-bit quantized colors.

## License

MIT. `apca-w3`, whose license limits it to web accessibility use, is only a development dependency of the tests.

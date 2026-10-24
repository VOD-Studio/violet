# @violetjs/theme

[English](./README.md)

用一个种子色生成浅色与深色两种外观下的 12 档色阶：带透明度版本的品牌与中性色阶，以及色相固定的危险、警告与成功色阶。任何种子色生成的文字、实色前景与控件边界都同时通过 WCAG 2.2 AA 与 APCA 门槛，另有供 `prefers-contrast: more` 使用的提高对比度档位；全部颜色落在 sRGB 内，相同输入总是得到相同输出。零依赖，不使用 Node API，浏览器、SSR 与构建脚本都能运行。

```sh
pnpm add @violetjs/theme
```

## 用法

包只导出三个入口函数。

```ts
import { generateScales, normalizeTheme, toCssVariables } from "@violetjs/theme";

// 1. 规范化不可信输入（Cookie、表单字段）；非法输入回落为默认主题。
const theme = normalizeTheme({ version: 1, seed: "#3A7BD5" });
// { version: 1, seed: "#3a7bd5", knobs: { neutralChroma: 0.015 } }

// 2. 按外观生成色阶，可选提高对比度档位。
const light = generateScales(theme, { appearance: "light" });
const dark = generateScales(theme, { appearance: "dark" });
const lightMore = generateScales(theme, { appearance: "light", contrast: "more" });
const darkMore = generateScales(theme, { appearance: "dark", contrast: "more" });
light.brand.steps[9]; // "oklch(…)"：品牌实色
light.brand.contrast; // 第 9、10 档上的文字色
light.brand.alpha[3]; // "color(srgb … / …)"：叠在页面背景上等同第 3 档的半透明色
light.status.danger.steps[11]; // 危险文字

// 3. 序列化为 CSS 自定义属性。
const css = toCssVariables([light, dark, lightMore, darkMore]);
// :root {
// 	--brand-1: light-dark(oklch(…), oklch(…));
// 	…
// }
// @media (prefers-contrast: more) {
// 	:root { … }
// }
```

同时传入两种外观时，每个值是一对 `light-dark()`，页面需要设置 `color-scheme: light` 或 `color-scheme: dark`（例如 `:root { color-scheme: light } .dark { color-scheme: dark }`）；只传一种外观时直接输出值。`"more"` 档位的结果写进 `prefers-contrast: more` 媒体查询，覆盖同名变量。`toCssVariables(scales, { selector, prefix })` 可改选择器（默认 `:root`）和变量前缀（`prefix: "v-"` 得到 `--v-brand-1`）。

| 变量 | 色阶 |
| --- | --- |
| `--brand-1` … `--brand-12`、`--brand-contrast`、`--brand-a1` … `--brand-a12` | 品牌，由种子色派生 |
| `--neutral-1` … `--neutral-12`、`--neutral-contrast`、`--neutral-a1` … `--neutral-a12` | 中性，带种子色的色相 |
| `--danger-*`、`--warning-*`、`--success-*` | 状态色，色相固定 |

## 主题

| 字段 | 含义 |
| --- | --- |
| `version` | 数据版本，目前为 `1`；其他版本回落为默认主题。 |
| `seed` | `#rgb` 或 `#rrggbb`。品牌色阶保持其色相，并尽量保留色度。 |
| `knobs.neutralChroma` | 中性色阶最强几档的色度，`0`–`0.05`，默认 `0.015`；不超过种子色本身的色度，`0` 为纯灰。 |

种子色格式不对时 `generateScales` 抛出 `TypeError`。`normalizeTheme(input, fallback?)` 从不抛错：不是对象、版本不符或种子色非法时返回 `fallback`，单个旋钮非法时只回落该旋钮，未知旋钮被丢弃，因此结果可以安全地拼进 CSS。

## 档位

档位分工沿用 [Radix Colors](https://www.radix-ui.com/colors/docs/palette-composition/understanding-the-scale)。两种外观下，第 1–8 档与第 11–12 档的亮度都随档位单调远离背景；实色第 9–10 档像 Radix 的第 9 档一样锚定种子色。每条色阶都在品牌、中性与它自己的背景档上满足同一套门槛。

| 档位 | 用途 | 标准档 | `"more"` 档 |
| --- | --- | --- | --- |
| 1–2 | 页面背景、表面 | | |
| 3–5 | 组件底色：常态、悬停、按下 | | |
| 6 | 装饰性分隔线 | | |
| 7–8 | 控件边界、焦点环 | WCAG 3:1，APCA Lc 30 | WCAG 4.5:1，Lc 45 |
| 9–10 | 实色及其悬停 | 对背景 APCA Lc 15（[WCAG 1.4.11](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast) 不要求带文字按钮的填充色与页面对比）；其上的 `contrast`：WCAG 4.5:1，Lc 60 | Lc 30；`contrast`：WCAG 7:1，Lc 75 |
| 11 | 次要文字、链接 | WCAG 4.5:1，APCA Lc 75；在第 3–5 档上 Lc 60 | WCAG 7:1，Lc 90；在第 3–5 档上 Lc 75 |
| 12 | 正文 | WCAG 4.5:1，APCA Lc 90；在第 3–5 档上 Lc 75 | WCAG 7:1，Lc 100；在第 3–5 档上 Lc 90 |

标准档的 APCA 档位取自其用途分档：Lc 90 是字号表对 16px/400 正文的要求，Lc 75 是正文的最低值，Lc 60 用于标签、按钮等其余可读内容，Lc 30 用于有语义的非文字元素，Lc 15 是大面积按钮可辨的下限。`"more"` 档整体上调 Lc 15（APCA 对 AAA 的换算），正文在近白背景上至多做到 Lc 100，文字的 WCAG 门槛取 AAA 的 7:1。

近白或近黑文字能在种子色上达标时，第 9 档就是种子色本身；否则只把它的亮度移到最近的可行值。`contrast` 取所需移动更小的那种文字色，两种外观一致：中等亮度的饱和色在深色下同样配白字，黄色这类亮种子保持明亮并配近黑字。第 10 档（悬停）朝文字对比度更高的方向偏移：白字时变暗，近黑字时变亮。

## 状态色阶

危险、警告与成功的种子固定，不随主题变化，生成规则与品牌色阶相同。

## 透明度色阶

`brand.alpha` 与 `neutral.alpha` 是各档的半透明版本：叠在中性第 1 档（页面背景）上时，与实色档的色差低于可察觉阈值 ΔE<sub>OK</sub> 0.02。每档取让颜色留在 sRGB 内的最小透明度；浏览器在 sRGB 中合成，所以写成 `color(srgb … / α)`。

## 原理

在 OKLCH 中计算。每档的亮度由对背景的目标 WCAG 对比度反解（思路同 [Adobe Leonardo](https://leonardocolor.io/)）。APCA 在部分区间（尤其深色）比 WCAG 2 更严，求解时把各 APCA 档位折算成 WCAG 比值目标。超出目标色域的颜色保持亮度和色相、只降色度，与 [CSS Color 4 色域映射](https://www.w3.org/TR/css-color-4/#gamut-mapping)一致。输出的亮度与色度保留四位小数，取整后仍在色域内。

运行时不包含 APCA。测试以 1° 步长遍历全部色相，覆盖整个色度范围、多档种子亮度与旋钮两端，两种外观与两个对比度档位都跑一遍，对精确值与 8 位量化值都用官方 [`apca-w3`](https://github.com/Myndex/apca-w3) 和 WCAG 2.2 逐对校验。

## 许可证

MIT。许可证限定于网页无障碍用途的 `apca-w3` 只是测试的开发依赖。

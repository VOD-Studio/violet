# @violetjs/theme

[English](./README.md)

用一个种子色生成浅色与深色两种外观下的 12 档品牌色阶与中性色阶。任何种子色生成的文字、实色前景与控件边界都同时通过 WCAG 2.2 AA 与 APCA 门槛，全部颜色落在 sRGB 内，相同输入总是得到相同输出。零依赖，不使用 Node API，浏览器、SSR 与构建脚本都能运行。

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

// 2. 生成某一外观的色阶。
const light = generateScales(theme, { appearance: "light" });
const dark = generateScales(theme, { appearance: "dark" });
light.brand.steps[9]; // "oklch(…)"：品牌实色
light.brand.contrast; // 第 9、10 档上的文字色

// 3. 序列化为 CSS 自定义属性。
const css = toCssVariables([light, dark]);
// :root {
// 	--brand-1: light-dark(oklch(…), oklch(…));
// 	…
// 	--brand-contrast: light-dark(oklch(…), oklch(…));
// 	--neutral-1: light-dark(oklch(…), oklch(…));
// 	…
// }
```

同时传入两种外观时，每个值是一对 `light-dark()`，页面需要设置 `color-scheme: light` 或 `color-scheme: dark`（例如 `:root { color-scheme: light } .dark { color-scheme: dark }`）；只传一种外观时直接输出值。`toCssVariables(scales, { selector, prefix })` 可改选择器（默认 `:root`）和变量前缀（`prefix: "v-"` 得到 `--v-brand-1`）。

## 主题

| 字段 | 含义 |
| --- | --- |
| `version` | 数据版本，目前为 `1`；其他版本回落为默认主题。 |
| `seed` | `#rgb` 或 `#rrggbb`。品牌色阶保持其色相，并尽量保留色度。 |
| `knobs.neutralChroma` | 中性色阶最强几档的色度，`0`–`0.05`，默认 `0.015`；不超过种子色本身的色度，`0` 为纯灰。 |

种子色格式不对时 `generateScales` 抛出 `TypeError`。`normalizeTheme(input, fallback?)` 从不抛错：不是对象、版本不符或种子色非法时返回 `fallback`，单个旋钮非法时只回落该旋钮，未知旋钮被丢弃，因此结果可以安全地拼进 CSS。

## 档位

档位分工沿用 [Radix Colors](https://www.radix-ui.com/colors/docs/palette-composition/understanding-the-scale)。两种外观下，第 1–8 档与第 11–12 档的亮度都随档位单调远离背景；实色第 9–10 档像 Radix 的第 9 档一样锚定种子色。

| 档位 | 用途 | 对两条色阶第 1–2 档的保证 |
| --- | --- | --- |
| 1–2 | 页面背景、表面 | |
| 3–5 | 组件底色：常态、悬停、按下 | |
| 6 | 装饰性分隔线 | |
| 7–8 | 控件边界、焦点环 | WCAG 3:1，APCA Lc 30 |
| 9–10 | 实色及其悬停 | APCA Lc 15（[WCAG 1.4.11](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast) 不要求带文字按钮的填充色与页面对比）；其上的 `contrast`：WCAG 4.5:1，APCA Lc 60 |
| 11 | 次要文字、链接 | WCAG 4.5:1，APCA Lc 75 |
| 12 | 正文 | WCAG 4.5:1，APCA Lc 90 |

文字在组件底色（两条色阶的第 3–5 档）上同样达标：第 12 档 WCAG 4.5:1、APCA Lc 75，第 11 档 WCAG 4.5:1、APCA Lc 60。APCA 档位取自其用途分档：Lc 90 是字号表对 16px/400 正文的要求，Lc 75 是正文的最低值，Lc 60 用于标签、按钮等其余可读内容，Lc 30 用于有语义的非文字元素。

近白或近黑文字能在种子色上达标时，第 9 档就是种子色本身；否则只把它的亮度移到最近的可行值。`contrast` 取所需移动更小的那种文字色，两种外观一致：中等亮度的饱和色在深色下同样配白字，黄色这类亮种子保持明亮并配近黑字。第 10 档（悬停）朝文字对比度更高的方向偏移：白字时变暗，近黑字时变亮。

## 原理

在 OKLCH 中计算。每档的亮度由对背景的目标 WCAG 对比度反解（思路同 [Adobe Leonardo](https://leonardocolor.io/)）。APCA 在部分区间（尤其深色）比 WCAG 2 更严，求解时把各 APCA 档位折算成 WCAG 比值目标。超出目标色域的颜色保持亮度和色相、只降色度，与 [CSS Color 4 色域映射](https://www.w3.org/TR/css-color-4/#gamut-mapping)一致。输出的亮度与色度保留四位小数，取整后仍在色域内。

运行时不包含 APCA。测试以 1° 步长遍历全部色相，覆盖整个色度范围、多档种子亮度与旋钮两端，对精确值与 8 位量化值都用官方 [`apca-w3`](https://github.com/Myndex/apca-w3) 和 WCAG 2.2 逐对校验。

## 许可证

MIT。许可证限定于网页无障碍用途的 `apca-w3` 只是测试的开发依赖。

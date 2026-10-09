# @violet/sketch

框架无关的手绘矢量绘图库：输入图形或 SVG path，输出像真人用某支笔画出的矢量笔墨，SVG 与 Canvas 共用同一份生成结果。需求与规格见 [PRD-0035](../../../docs/prd/0035-可扩展手绘绘图库.md) 与 [M1 规格](../../../docs/prd/0035-手绘绘图库M1规格.md)。当前为 0.2.0：笔画规划与三档手法、逐点压力与三支笔（签字笔、压感钢笔、马克笔）、七种填充、卡通风格，以及整图时间轴（顺序、并行、交错）。

## 调用

```ts
import { draw, fills, rect, styles } from "@violet/sketch";
import { mountSvg, updateSvgPalette } from "@violet/sketch/svg";

const drawing = draw(
	{
		width: 160,
		height: 100,
		items: [{ id: "card", path: rect(10, 10, 140, 80, 8), fillRole: "surface" }],
	},
	{ style: { ...styles.natural, fill: fills.hachure }, seed: 35 },
);
const palette = { paper: "#fff", ink: "#252332", surface: "#eadcf4" };
const svg = mountSvg(drawing, palette);
document.body.append(svg);
updateSvgPalette(svg, { ...palette, surface: "#c3dfe7" });
```

`@violet/sketch/canvas` 的 `drawCanvas(drawing, canvas, palette)` 渲染同一结果；`renderSvg` 不依赖 DOM，可在 Worker 或 Node 中输出 SVG 文本。

## 概念

| 维度 | 职责 | 内置 |
| --- | --- | --- |
| 手法 `Hand` | 骨架 → 笔画：断笔、越界、首尾重叠、抖动、复画与逐点压力 | `hands.neat` / `natural` / `draft`、`cartoonHand` |
| 笔 `Pen` | 笔画 → 渲染批次：笔尖、压力的用途、墨与叠色 | `fineliner`、`inkpen`、`marker` |
| 填充 `Fill` | 区域 → 直接上色的区域，或交给手法与笔成形的图案骨架 | `fills` 中的七种，名称同 Rough.js；`createCartoonFill` |
| 风格 `Style` | 三者组合 | `styles.neat` / `natural` / `draft`、`cartoonStyle` |

- **笔画**（`Stroke`）逐点携带 `[x, y, pressure, t]`，是各维度之间唯一的数据形态。**压感是每支笔的属性**：手法产生压力，笔决定它影响粗细、浓淡还是透明度。
- 笔与卡通风格以具名导出提供，未用到的不会进入打包结果；`pens` 对象一次引入全部三支笔。
- 颜色只以角色出现，换色不重新生成。`pinEnds` 让开放路径首尾保持精确，用于连线与箭头锚点；`lineWidth` 按图元覆盖线宽。
- 相同输入、版本与 seed 输出逐位相同；随机由 `(seed, 图元 id, 通道, 序号)` 哈希派生，修改一个图元不影响其他图元。

## 笔

```ts
import { createFineliner, createMarker, inkpen, styles } from "@violet/sketch";

const writing = { ...styles.natural, pen: inkpen };                    // 压感钢笔
const marker = { ...styles.natural, pen: createMarker({ weight: 7, opacity: 0.45 }) };
const light = { ...styles.natural, pen: createFineliner({ pressure: 0.4 }) };
```

| 笔 | 笔尖与压力 |
| --- | --- |
| `fineliner` | 圆笔尖，默认恒宽并走原生描边；`createFineliner({ pressure })` 让线宽随压力变化 |
| `inkpen` | 圆笔尖，线宽 0.08 到 1.25 倍随压力变化，起收笔收尖 |
| `marker` | 扁笔尖（角度 −35°，短长轴比 0.28），半透明，不同笔画重叠处叠色加深 |

自定义变宽笔用 `createRibbonPen`：给出笔尖角度与短长轴比、压力到宽度的映射和是否分笔叠色即可。

## 卡通风格

```ts
import { cartoonPalette, cartoonStyle, draw, circle } from "@violet/sketch";

const palette = cartoonPalette({ paper: "#fffdf7", ink: "#2b2836", moon: "#f7e6a1" });
const drawing = draw(
	{ width: 200, height: 200, items: [{ id: "moon", path: circle(100, 100, 60), fillRole: "moon", lineWidth: 2.6 }] },
	{ style: cartoonStyle, seed: 3 },
);
```

`cartoonPalette` 在 OKLCH 中为每个基础色派生 `角色:shade`（压暗并偏冷）、`角色:light`（提亮并偏暖）与 `角色:line`（同色相的深色线）。阴影与高光是图形与朝光源平移副本的差，由几何推导，没有固定模板；底色与线稿轻微错位。

## 整图时间轴

```ts
import { createPlayer, createSchedule } from "@violet/sketch";
import { mountSvg, seekSvg } from "@violet/sketch/svg";

const schedule = createSchedule(drawing, { mode: "stagger" });   // "sequential" | "parallel" | "stagger"
const svg = mountSvg(drawing, palette, { schedule });
const player = createPlayer({ duration: schedule.duration, onFrame: (t) => seekSvg(svg, t) });
player.play();   // pause()、seek(t)、restart()、cancel()、rate
```

Canvas 用 `drawCanvas(drawing, canvas, palette, { schedule, time })` 在每帧重绘。动画只改变显现范围，使用已生成的笔画：恒宽描边用虚线偏移，变宽条带显现前缀多边形，区域填充整体淡入，不使用遮罩、缩放或滑入。暂停、跳转与倒放不重新生成；取消与重播会使旧的完成回调失效。

## 扩展

任一维度都可以是包外的普通对象，直接放进 `Style`，无需注册，也不改核心与渲染器：

```ts
import { BatchBuilder, channel, type Pen } from "@violet/sketch";

const WIDTH = channel("my-ribbon:width");
export const ribbon: Pen = {
	id: "ribbon",
	ink(strokes, ctx, role) {
		const batch = new BatchBuilder({ mode: "stroke", role, width: ctx.width * (2 + ctx.random(WIDTH, 0)), opacity: 0.5 });
		for (const stroke of strokes) batch.stroke(stroke);
		return batch.empty ? [] : [batch.build()];
	},
};
```

- 随机只能来自 `ctx.random` / `ctx.noise`；通道编号用 `channel()` 在创建时换算一次。
- `Pen.ink` 必须返回新建的批次，生成器会就地归一化其 `spans`。
- 输出顶点与笔画数由生成器统一计量；超过 `maxVertices` / `maxStrokes` 抛出 `BudgetExceeded`，不返回部分结果，也不自动降低细节。

## 模块

| 目录 | 内容 |
| --- | --- |
| `core/` | 路径与图元、展平与角点、确定性随机、渲染批次构造、派生色 |
| `hand/` | 笔画规划、最小 jerk 手法、压力与预设 |
| `pen/` | 条带轮廓、签字笔、压感钢笔、马克笔 |
| `fill/` | 扫描线、图案填充与卡通填充 |
| `animate/` | 编排与播放器 |
| `render/` | SVG、Canvas、显现轨迹与配色解析 |

## 构建、测试与基准

在 `web/` 下运行：

```sh
pnpm --filter @violet/sketch typecheck
pnpm exec vitest run packages/sketch
pnpm --filter @violet/sketch build
node packages/sketch/bench/compare-rough.ts
```

基准用 PRD-0035 Rough.js 基线的同一组场景对照生成与路径序列化耗时及输出字节，结果记录在 [0.2.0 验收记录](../../../docs/research/sketch-m1-validation.md)。

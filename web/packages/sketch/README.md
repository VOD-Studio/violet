# @violet/sketch

框架无关的手绘矢量绘图库：输入图形或 SVG path，输出像真人用某支笔画出的矢量笔墨，SVG 与 Canvas 共用同一份生成结果。需求与规格见 [PRD-0035](../../../docs/prd/0035-可扩展手绘绘图库.md) 与 [M1 规格](../../../docs/prd/0035-手绘绘图库M1规格.md)。当前为 0.2.0，覆盖 M1：笔画规划、三档手法、签字笔与七种填充；压感、马克笔、卡通风格与动画在后续里程碑交付。

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
| 手法 `Hand` | 骨架 → 笔画：断笔、越界、首尾重叠、抖动与复画 | `hands.neat` / `natural` / `draft` |
| 笔 `Pen` | 笔画 → 渲染批次：笔尖、压力作用、墨 | `pens.fineliner` |
| 填充 `Fill` | 区域 → 实色区域或图案骨架；图案再经手法与笔成形 | `fills` 中的七种，名称同 Rough.js |
| 风格 `Style` | 三者组合 | `styles.neat` / `natural` / `draft` |

- **笔画**（`Stroke`）逐点携带 `[x, y, pressure, t]`，是各维度之间唯一的数据形态；渲染批次的 `spans` 记录每个子路径按图元归一化的落笔时间。
- 颜色只以角色出现，换色不重新生成。
- `pinEnds` 让开放路径首尾保持精确，用于连线与箭头锚点。
- 相同输入、版本与 seed 输出逐位相同；随机由 `(seed, 图元 id, 通道, 序号)` 哈希派生，修改一个图元不影响其他图元。

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
| `core/` | 路径与图元、展平与角点、确定性随机、渲染批次构造 |
| `hand/` | 笔画规划、最小 jerk 手法与预设 |
| `pen/` | 签字笔 |
| `fill/` | 扫描线与图案填充 |
| `render/` | SVG、Canvas 与配色解析 |

## 构建、测试与基准

在 `web/` 下运行：

```sh
pnpm --filter @violet/sketch typecheck
pnpm exec vitest run packages/sketch
pnpm --filter @violet/sketch build
node packages/sketch/bench/compare-rough.ts
```

基准用 PRD-0035 Rough.js 基线的同一组场景对照生成与路径序列化耗时及输出字节，结果记录在 [M1 验收记录](../../../docs/research/sketch-m1-validation.md)。

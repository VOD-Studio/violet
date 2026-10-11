# API 文档

[English](./api.md) | 简体中文

- [绘制](#绘制)：`draw`、`Scene`、`SceneItem`、`DrawOptions`、`Drawing`、`BudgetExceeded`
- [几何](#几何)：`rect`、`circle`、`ellipse`、`line`、`polyline`、`polygon`、`curve`、`arc`、`pathFromSvg`、`PathBuilder`
- [风格](#风格)：`Style`、`styles`、`lineWashStyle`
- [手法](#手法)：`hands`、`fillHands`、`createHand`
- [笔](#笔)：`fineliner`、`inkpen`、`gpen`、`marker` 及其工厂函数、`createRibbonPen`
- [填充](#填充)：`fills`、`createPatternFill`、`createWashFill`
- [渲染](#渲染)：`renderSvg`、`mountSvg`、`seekSvg`、`updateSvgPalette`、`pathData`、`drawCanvas`
- [动画](#动画)：`createSchedule`、`itemProgress`、`createPlayer`
- [扩展接口](#扩展接口)：`Hand`、`Pen`、`Fill`、`DrawContext`、`BatchBuilder` 与辅助函数

所有坐标都以场景单位计。除非特别说明，「线宽」指图元的名义线宽。

## 绘制

### `draw(scene, options): Drawing`

为场景中的每个图元生成笔画与填充。结果不含 DOM 对象，可以用不同的调色板和渲染器反复渲染。

```ts
import { circle, draw, styles } from "@violetjs/inkline";

const drawing = draw(
  { width: 200, height: 200, items: [{ id: "sun", path: circle(100, 100, 60), fillRole: "sun" }] },
  { style: styles.natural, seed: 7 },
);
```

随机数由 `seed`、图元 `id` 与内部通道共同派生：相同输入与 seed 总是得到完全相同的输出，修改一个图元也不会影响其他图元。

#### `Scene`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `width`、`height` | `number` | 场景尺寸，用作 SVG 的 `viewBox`。 |
| `items` | `SceneItem[]` | 按绘制顺序排列的图元，后面的画在上层。 |

#### `SceneItem`

| 字段 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `id` | `string` | | 场景内唯一且稳定，与 seed 一起决定该图元的随机序列。 |
| `path` | `Path` | | 要画的几何，用[几何](#几何)函数创建。 |
| `style` | `Style` | `options.style` | 只作用于该图元的风格。 |
| `fillRole` | `string` | 无 | 填充使用的调色板角色；不设置则不填充。只有闭合子路径会被填充。 |
| `strokeRole` | `string` | `"ink"` | 描边使用的调色板角色；`"none"` 表示不描边。 |
| `lineWidth` | `number` | `options.width` | 该图元的名义线宽。 |
| `pinEnds` | `boolean` | `false` | 开放路径的两端保持原位，用于连线与箭头锚点。 |
| `transform` | `[a, b, c, d, e, f]` | 无 | 渲染时应用的仿射矩阵，顺序同 SVG 的 `matrix()`。 |
| `label` | `{ text, x, y, size? }` | 无 | 以 `(x, y)` 为中心的文字，使用图元自身坐标；`size` 默认 14。不做排版与换行。 |

#### `DrawOptions`

| 字段 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `style` | `Style` | 必填 | 没有自带风格的图元使用的默认风格。 |
| `seed` | `number` | `1` | 任意整数，0 也有效。 |
| `width` | `number` | `2` | 默认名义线宽。 |
| `precision` | `number` | `0.25` | 曲线展平与轮廓精简的容差。 |
| `pixelScale` | `number` | `1` | 每个场景单位对应的 CSS 像素。手法中以 CSS 像素给出的参数（如 `maxStroke`、`segment`）按它换算。 |
| `maxVertices` | `number` | `2000000` | 整个场景的输出顶点上限。 |
| `maxStrokes` | `number` | `200000` | 整个场景的笔画上限。 |

#### `Drawing`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `width`、`height` | `number` | 来自场景。 |
| `items` | `DrawnItem[]` | 与场景图元一一对应：`id`、`batches`（渲染批次，填充在下、描边在上）、`duration`（以弧长计的自然落笔时长）、`transform` 与 `label`。 |
| `seed` | `number` | 使用的 seed。 |
| `budget` | `{ vertices, strokes }` | 输出规模。 |
| `generateMs` | `number` | 生成耗时，毫秒。 |

#### `BudgetExceeded`

输出将超过 `maxVertices` 或 `maxStrokes` 时由 `draw` 抛出，带有 `kind`（`"vertices"` 或 `"strokes"`）、`actual` 与 `limit`。`draw` 不会返回只画了一部分的结果，也不会自行降低细节。

## 几何

以下函数都返回不可变的 `Path`：只含绝对坐标的 `M`、`L`、`C`、`Z` 命令，二次曲线与圆弧已转为三次贝塞尔。请把路径当作值使用，生成过程按对象身份缓存几何。

| 函数 | 说明 |
| --- | --- |
| `rect(x, y, width, height, radius = 0)` | 矩形；`radius` 大于 0 时为圆角矩形。 |
| `circle(cx, cy, r)` | 圆。 |
| `ellipse(cx, cy, rx, ry)` | 轴对齐的椭圆。 |
| `line(x1, y1, x2, y2)` | 直线。 |
| `polyline(points, closed = false)` | 经过 `[x, y]` 各点的折线。 |
| `polygon(points)` | 闭合多边形。 |
| `curve(points)` | 经过各点的平滑开放曲线（向心 Catmull-Rom）。 |
| `arc(cx, cy, rx, ry, start, end, closed = "none")` | 起止角（弧度）之间的椭圆弧；`closed` 取 `"none"`、`"chord"` 或 `"pie"`。 |
| `pathFromSvg(d, fillRule = "nonzero")` | 解析 SVG path 数据，支持相对命令与圆弧。 |
| `transformPath(path, [a, b, c, d, e, f])` | 应用仿射矩阵。 |
| `mergePaths(paths, fillRule)` | 把多条路径的子路径合成一条。 |
| `createPath(verbs, coords, fillRule = "nonzero")` | 由原始数组构造路径。动词：`MOVE` 0、`LINE` 1、`CUBIC` 2、`CLOSE` 3。 |

`new PathBuilder()` 用 `moveTo`、`lineTo`、`quadTo`、`cubicTo`、`close` 与 `build(fillRule)` 逐步构造路径。

`Path` 包含 `verbs`（`Uint8Array`）、`coords`（`Float64Array`）、`fillRule`（`"nonzero"` 或 `"evenodd"`）与 `bounds`（`{ x, y, width, height }`，按控制点估算）。

## 风格

风格把手法、笔与填充组合在一起。

| 字段 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `hand` | `Hand` | 必填 | 描绘轮廓。 |
| `pen` | `Pen` | 必填 | 给轮廓上墨。 |
| `fill` | `Fill` | 实色 | 填充设置了 `fillRole` 的图元。 |
| `fillHand` | `Hand` | `hand` | 描绘图案线条。 |
| `fillPen` | `Pen` | `pen` | 给图案线条上墨。 |
| `fillWeight` | `number` | `0.5` | 图案线宽相对图元线宽的倍率。 |
| `lineRole` | `(fillRole) => string` | `"ink"` | 图元没有 `strokeRole` 时，由填充角色推导描边角色。 |

风格是普通对象，用展开语法扩展即可：`{ ...styles.natural, pen: gpen, fill: fills.dots }`。

| 预设 | 组成 |
| --- | --- |
| `styles.neat` | 工整手法、签字笔、实色填充。 |
| `styles.natural` | 自然手法、签字笔、实色填充。 |
| `styles.draft` | 草稿手法（每笔画两遍）、签字笔、实色填充。 |
| `lineWashStyle` | 勾线手法、G 笔与淡彩填充，图案线宽为 0.55 倍。 |

`lineWashStyle` 单独导出而不放进 `styles`，这样没用到它的打包结果不会带上 G 笔与淡彩填充。

## 手法

`hands.neat`、`hands.natural`、`hands.draft` 与 `hands.inking` 用于描绘轮廓。`fillHands` 有同样的四个键，参数更平稳，用于图案线条：转角不断笔、不越界、不复画。

### `createHand(options?, id = "hand"): Hand`

创建手法。未给出的参数取 `hands.natural` 的值。

| 参数 | 默认值 | 说明 |
| --- | --- | --- |
| `roughness` | `0.9` | 缓慢横向抖动的幅度，场景单位；短笔画会按比例减小。 |
| `bowing` | `1` | 每段直线弯曲程度的倍率。 |
| `breakChance` | `0.3` | 在转角处抬笔的概率，0 到 1。 |
| `overshoot` | `1` | 转角断笔处越界长度的倍率；0 表示不越界。 |
| `overshootLimit` | `2` | 越界长度上限，以线宽计。 |
| `overlap` | `[0.04, 0.1]` | 闭合曲线的最后一笔越过起点的长度，相对周长的比例。 |
| `maxStroke` | `360` | 单笔最大长度，CSS 像素；更长的线等分成几笔。 |
| `segment` | 无 | 笔长区间 `[min, max]`，CSS 像素。设置后长线由几段随机长度的短笔接成，不再等分。 |
| `gap` | `[0, 0]` | 上述短笔之间的间距区间 `[min, max]`，以线宽计；负值表示相互交叠。 |
| `passes` | `1` | 每笔画几遍；2 即草稿效果。 |
| `taper` | `10` | 两端压力渐变的长度，以线宽计。 |
| `taperShare` | `0.45` | 每端渐变最多占笔长的比例，让短笔保留实在的笔身。 |
| `tip` | `0.25` | 两端的压力，0 到 1；笔画中段的压力为 1。 |
| `pressureNoise` | `0.1` | 沿笔画随机起伏的压力幅度。 |

| 预设 | 覆盖的参数 |
| --- | --- |
| `neat` | `roughness: 0.35, bowing: 0.4, breakChance: 0.15, overshoot: 0.4` |
| `natural` | 无 |
| `draft` | `roughness: 1.8, bowing: 1.6, breakChance: 0.6, overshoot: 1.5, passes: 2` |
| `inking` | `roughness: 0.4, bowing: 0.5, breakChance: 0.8, overshoot: 2.2, overshootLimit: 6, overlap: [-0.04, 0.03], segment: [45, 160], gap: [-1, 3.5], taper: 9, taperShare: 0.22, tip: 0, pressureNoise: 0.16` |

## 笔

每支内置笔都同时提供默认实例与工厂函数。工厂函数都接受 `pressure`，即压感强度，从 0（恒宽）到 1（这支笔完整的压力曲线）；笔通过 `pen.pressure` 报告当前强度。

| 实例 | 工厂函数与参数 |
| --- | --- |
| `fineliner` | `createFineliner({ weight = 1, pressure = 0, retraceWeight = 0.75, retraceOpacity = 0.7 })`。`pressure` 为 0 时输出原生恒宽描边；大于 0 时线宽在 `1 − pressure` 到 1 之间变化。 |
| `inkpen` | `createInkPen({ weight = 1.6, pressure = 0.92 })`。`weight` 是满压时相对名义线宽的宽度。 |
| `gpen` | `createGPen({ weight = 0.75, pressure = 0.95 })`。常用压力下笔身约等于名义线宽，满压时约 1.2 倍。 |
| `marker` | `createMarker({ weight = 4, angle = -35, aspect = 0.28, opacity = 0.78, pressure = 0.15 })`。扁笔尖；`angle` 以度计，`aspect` 是短轴与长轴之比。每笔单独成层，笔画重叠处颜色加深。 |

`pens` 对象包含全部四支笔。导入它会把四支笔都打进产物；只用一支时按名字单独导入，打包体积更小。

`retraceWeight` 与 `retraceOpacity` 设置草稿手法第二遍相对第一遍的线宽与不透明度。

### `createRibbonPen(options): Pen`

创建变宽笔：把椭圆笔尖沿每条笔画扫过。

| 参数 | 默认值 | 说明 |
| --- | --- | --- |
| `id` | 必填 | 笔的名字。 |
| `weight` | 必填 | 压力为 1 时笔尖长轴的全宽，相对名义线宽。 |
| `angle` | `0` | 笔尖长轴的角度，度。 |
| `aspect` | `1` | 短轴与长轴之比，0 到 1；1 为圆笔尖。 |
| `minScale`、`maxScale` | 必填 | 压感强度为 1 时，压力 0 与 1 对应的线宽倍率。 |
| `gamma` | `1` | 压力曲线指数：线宽倍率为 `minScale + (maxScale − minScale) × pressure^gamma`。 |
| `pressure` | `1` | 压感强度。线宽倍率变为 `max(0.02, 1 + 强度 × (曲线 − 1))`。 |
| `opacity` | `1` | 墨的不透明度。 |
| `layered` | `false` | 每笔单独成层，不同笔画重叠处颜色加深。 |
| `retraceWeight`、`retraceOpacity` | `0.75`、`0.7` | 草稿第二遍的线宽与不透明度。 |

## 填充

`fills` 包含 `solid`、`hachure`、`cross-hatch`、`dashed`、`zigzag`、`zigzag-line` 与 `dots`。`solidFill` 等同于 `fills.solid`。

### `createPatternFill(pattern, options?): Fill`

创建自定义间距的图案填充。`pattern` 可取 `fills` 中除 `solid` 以外的任意键。

| 参数 | 默认值 | 说明 |
| --- | --- | --- |
| `gap` | `max(8 × 填充线宽, 5)` | 图案线条的间距。 |
| `angle` | `-41` | 线条角度，度。 |

### `createWashFill(options?): Fill`

创建水彩感的淡彩。平涂色朝背光侧错开并裁剪到图形内，朝光一侧因此留出宽窄不一的纸白；厚度超过 20 个单位的图形还会沿背光侧加短排线。留白与排线都按图形厚度（2 × 面积 ÷ 周长）换算，细长的图形不会被留白吃掉。

| 参数 | 默认值 | 说明 |
| --- | --- | --- |
| `light` | `[-0.55, -0.83]` | 指向光源的方向，场景坐标，y 轴向下。 |
| `highlight` | `0.1` | 纸白边的平均宽度，相对厚度，最多 7 个单位；0 表示色块贴满。 |
| `bleed` | `0.9` | 色块边缘的起伏幅度，相对留白宽度。 |
| `opacity` | `1` | 颜色的不透明度；小于 1 时后面的图形会透出来。 |
| `hatch` | `0.35` | 背光侧排线带的宽度，相对厚度；0 表示不画排线。 |
| `hatchGap` | `2.6` | 排线间距，以填充线宽计。 |
| `hatchAngle` | `58` | 排线角度，度。 |
| `hatchRole` | `"ink"` | 排线使用的调色板角色。 |

## 渲染

`Palette` 把图中用到的每个角色映射到 CSS 颜色，例如 `{ paper: "#fff", ink: "#222", sky: "#9fc9e8" }`。缺少某个角色时渲染会抛出错误，不会擅自猜一个颜色。

所有渲染器共用以下参数：

| 参数 | 默认值 | 说明 |
| --- | --- | --- |
| `background` | `"paper"` | 背景使用的调色板角色；`false` 表示透明背景。 |
| `fontFamily` | `"system-ui, sans-serif"` | 标签字体。 |

### `renderSvg(drawing, palette, options?): string`

返回独立的 SVG 文本，每个渲染批次一个 `<path>`。不依赖 DOM，可在 Node.js 与 Web Worker 中使用。

| 参数 | 默认值 | 说明 |
| --- | --- | --- |
| `decimals` | `2` | 坐标保留的小数位数。 |
| `idPrefix` | `"inkline"` | 内部 `clipPath` id 的前缀；会追加计数器，同一页面可以放多幅图。 |
| `title` | 无 | 无障碍名称，输出为 `<title>`。 |

### `mountSvg(drawing, palette, options?): SVGSVGElement`

用与 `renderSvg` 相同的参数构造 SVG 元素。传入 `schedule`（见[动画](#动画)）时，笔画会拆成可单独显现的元素；在调用 `seekSvg` 之前画面保持完整。需要浏览器 DOM。

### `seekSvg(svg, time)`

把带编排的 SVG 推进到 `time` 秒：已完成的笔画完整显示，进行中的笔画只显示已画出的部分，尚未开始的隐藏。跳转、暂停与倒放都不重新生成笔画。

### `updateSvgPalette(svg, palette)`

给 `mountSvg` 生成的 SVG 换色，几何不变。

### `pathData(verbs, coords, decimals = 2): string`

把路径命令序列化为 SVG path 数据。

### `drawCanvas(drawing, canvas, palette, options?)`

从 `@violetjs/inkline/canvas` 导入。把图画到 Canvas 上，像素尺寸取 Canvas 的 CSS 尺寸乘以 `devicePixelRatio`。传入 `schedule` 与 `time` 可以绘制动画中的某一帧。

## 动画

### `createSchedule(drawing, options?): Schedule`

为每个图元分配时间窗口。窗口只取决于图元的自然落笔时长，不改变笔画。

| 参数 | 默认值 | 说明 |
| --- | --- | --- |
| `mode` | `"sequential"` | `"sequential"`：图元依次绘制；`"parallel"`：全部同时开始、同时结束；`"stagger"`：依次起笔并相互重叠。 |
| `speed` | `600` | 落笔速度，场景单位每秒。 |
| `itemRange` | `[0.12, 2.5]` | 单个图元的最短与最长时长，秒。 |
| `gap` | 自动 | `"stagger"` 模式下相邻图元起笔的间隔，秒；默认让整幅图不超过 6 秒。 |

`Schedule` 包含 `mode`、以秒计的 `duration`，以及与 `drawing.items` 下标对应的 `start`、`end` 数组。

`itemProgress(schedule, index, time)` 返回某个图元在 `time` 时的进度，0 到 1。

### `createPlayer(options): Player`

播放编排用的时钟。它不持有笔画，只把当前时间传给 `onFrame`。

| 参数 | 默认值 | 说明 |
| --- | --- | --- |
| `duration` | 必填 | 总时长，秒。 |
| `onFrame(time)` | 必填 | 每次时间变化后调用。 |
| `onEnd()` | 无 | 自然播放到末尾时调用一次；取消、重新开始或跳转会使尚未触发的调用失效。 |
| `rate` | `1` | 播放倍率。 |
| `raf`、`cancelRaf` | `requestAnimationFrame` | 帧调度函数，可在测试或其他环境中替换。 |
| `now` | `performance.now` | 毫秒时钟。 |

`Player` 包含 `time`、`playing` 与可写的 `rate`，以及方法 `play()`（已在末尾时从 0 开始）、`pause()`、`seek(time)`（钳制范围，保持播放状态）、`restart()` 与 `cancel()`。

## 扩展接口

手法、笔与填充都是普通对象，把自己的实现放进风格即可，不需要注册。

```ts
interface Hand {
  id: string;
  strokes(skeleton: Skeleton, ctx: DrawContext): readonly Stroke[];
}

interface Pen {
  id: string;
  pressure?: number; // 当前压感强度；不响应压感的笔省略
  ink(strokes: readonly Stroke[], ctx: DrawContext, role: string): readonly InkBatch[];
}

interface Fill {
  id: string;
  generate(region: Skeleton, ctx: DrawContext, source: Path): {
    areas?: readonly Area[]; // { path, role?, opacity?, clip?: boolean | Path }
    guides?: Skeleton; // 图案线条，由 fillHand 描绘、fillPen 上墨
    guideRole?: string;
  };
}
```

- `Skeleton` 是展平后的路径：`contours`（每条含 `points`、累计弧长 `arc`、`corners`、`closed` 与 `length`）与 `fillRule`。
- `Stroke` 的 `points` 为 `[x, y, pressure, time] × n`；`curve` 为 true 时这些点是 Catmull-Rom 控制点；另有 `closed` 与 `pass`（0 为第一遍，大于 0 为草稿复画）。
- `DrawContext` 提供 `width`、`precision`、`pixelScale`、`pinEnds`、`fillRole`、`flatten(path)`，以及随机源 `random(channel, index)`（0 到 1）和 `noise(channel, x)`（约 −1 到 1）。
- 通道编号用 `channel("my-pen:width")` 创建一次。所有随机数都从 `ctx.random` 与 `ctx.noise` 取，输出才能保持确定。
- `new BatchBuilder({ mode, role, width?, opacity?, fillRule? })` 用 `stroke(stroke)`、`ribbon(ribbon, t0, t1)` 与 `path(path, t0, t1)` 把几何收集为 `InkBatch`；检查 `empty` 后调用 `build()`。`Pen.ink` 要返回新建的批次，生成器会接管它们并归一化其中的时间。
- 工厂签名为 `(options?: { pressure?: number }) => Pen`（即 `PenFactory`）的笔，可以像内置笔一样调节压感。

内置实现用到的底层辅助函数也一并导出：`flatten(path, precision)`、`pointAt(contour, distance, out)`、`polylineContour(points, closed)`、`catmullRomToCubics(values, stride, emit)`、`strokeRibbon(stroke, options)`、`minimumJerk(t)`、`createRandom(seed, key)` 与 `hashString(text)`。

### 数据与辅助函数契约

除注明入口外，下列名称均从根入口导出。

| 类型 / 函数 | 契约 |
| --- | --- |
| `Bounds`、`Matrix`、`Label`、`Budget` | 依次为 `{ x, y, width, height }`、只读 `[a,b,c,d,e,f]`、`{ text, x, y, size? }`、只读 `{ vertices, strokes }`。 |
| `Contour` | 只读 `points: Float64Array`（x/y 交错，闭合时不重复起点）、`arc: Float64Array`、`corners: Uint32Array`、`closed: boolean`、`length: number`。闭合长度包含最后一条边。 |
| `Stroke` | 只读 `points: Float32Array`（x/y/pressure/time）、`curve`、`closed`、`pass`。 |
| `Area`、`FillOutput` | 区域为 `{ path, role?, opacity?, clip? }`。`clip: true` 使用原路径，传入 `Path` 则按其裁剪。`FillOutput` 含可选的只读 `areas`、`guides: Skeleton`、`guideRole`；未指定颜色角色时使用图元填充角色。 |
| `InkBatch` | 只读 `mode: "stroke" \| "fill"`、`role`，可选 `width`（1）、`opacity`（1）、`fillRule`、`clip: Path`；`verbs: Uint8Array`、`coords: Float32Array`、`spans: Float32Array`（每条子路径的 t0/t1），可选 `ribbons: Uint32Array`（每条子路径的 n/c，非条带为 0/0）。 |
| `RandomSource` | `random(channel, integerIndex): number` 返回 `[0,1)`，与调用顺序无关。`noise(channel, x)` 为连续梯度噪声，约 `[-1,1]`，整数格点处为零。`scope(salt: number): RandomSource` 派生独立作用域；`DrawContext` 同样提供 `scope`。 |
| `createRandom(seed: number, key: number): RandomSource` | 创建确定性随机源；字符串作用域键可用 `hashString(text): number` 得到。`channel(name): number` 用于预先计算通道编号。 |
| `flatten(path, precision): Skeleton` | 展平曲线并识别角点，按路径身份与容差缓存；不要修改输入路径或返回的几何数据。 |
| `polylineContour(xy: ArrayLike<number>, closed = false): Contour` | 接收交错 x/y 而非元组；没有可用点时抛出 `RangeError`。 |
| `pointAt(contour, distance, out: Float64Array): void` | 向长度至少为 4 的数组写入 `[x,y,tangentX,tangentY]`；闭合轮廓按周长循环，开放轮廓钳制到端点。 |
| `catmullRomToCubics(values, stride, emit): void` | 每个 stride 的前两项为 x/y。回调 `emit(cubic: Float64Array, segment: number)` 接收 `[c1x,c1y,c2x,c2y,x,y]`。数组复用，必须在回调内读取或复制；少于两点不输出。 |
| `minimumJerk(t): number` | `10t³ − 15t⁴ + 6t⁵`；t 在 `[0,1]` 内时平滑地从 0 过渡到 1。 |
| `Nib` | `{ angle: number, aspect: number }`，角度单位为**弧度**，轴比为 `(0,1]`；上层笔工厂的角度则用度。 |
| `RibbonOptions` | 必填 `width`、`nib: Nib`、`minScale`、`maxScale`、`gamma`、`precision`；width 是场景单位的笔尖全宽。 |
| `strokeRibbon(stroke, options): Ribbon` | 将笔尖扫成多边形；`Ribbon` 含只读 `points: Float32Array`、`n`、`c`：左侧 n 点、末端帽 c 点、反向右侧 n 点、起端帽 c 点。 |
| `SvgOptions`（`/svg`） | 公共 `RenderOptions` 加 `decimals`、`idPrefix`、`title`、`schedule`。只有 `mountSvg` 使用 schedule；`renderSvg` 始终返回完整画面。 |
| `CanvasOptions`（`/canvas`） | 公共 `RenderOptions` 加 `schedule`、`time`（秒，默认编排总时长）。 |

`PathBuilder.moveTo(x,y)`、`.lineTo(x,y)`、`.quadTo(cx,cy,x,y)`、`.cubicTo(c1x,c1y,c2x,c2y,x,y)`、`.close()` 均返回 builder；`.build(fillRule = "nonzero")` 返回 `Path`。`createPath` 接收 `Uint8Array` 动词与 `Float64Array` 坐标并保留这些数组，调用方不得继续修改它们。

工厂同时导出参数类型：`HandOptions`、`PenOptions`、`FinelinerOptions`、`InkPenOptions`、`GPenOptions`、`MarkerOptions`、`RibbonPenOptions`、`PatternOptions`、`WashOptions`、`ScheduleOptions`、`PlayerOptions`；字段与默认值见上方对应章节。`ScheduleMode` 为 `"sequential" | "parallel" | "stagger"`。`Palette`、`RenderOptions` 从根入口导出，`SvgOptions`、`CanvasOptions` 从各自渲染入口导出。

# @violet/sketch

与 React、站点和绘制后端解耦的矢量笔迹实验包。当前在 workspace 内使用，未发布 npm；它是 PRD-0035 的可运行验证实现，不表示已经通过正式替换 Rough.js 的验收。

## 调用

```ts
import {
  createNaturalPen,
  generateScene,
  mountSvg,
  rectangleGeometry,
  updateSvgPalette,
  updateSvgProgress,
} from "@violet/sketch";

const scene = {
  width: 160,
  height: 100,
  items: [{
    id: "card",
    geometry: rectangleGeometry(10, 10, 140, 80, 8),
    fillRole: "surface",
    strokeRole: "ink",
  }],
};
const palette = { paper: "#fff", ink: "#252332", surface: "#eadcf4" };
const drawn = generateScene(scene, createNaturalPen(), { seed: 35, width: 2.2 });
const svg = mountSvg(drawn, palette);
document.body.append(svg);
updateSvgProgress(svg, drawn, 0.5, true);
updateSvgPalette(svg, { ...palette, surface: "#c3dfe7" });
```

`drawCanvas(drawn, canvas, palette, progress, sequential)` 使用同一个生成结果；Canvas 必须有非零 CSS 尺寸，函数按设备 DPR 调整 backing store。完整静态图的进度为 1。SVG 可直接用 `XMLSerializer` 序列化，不依赖站点 CSS、图片纹理或 JS 才能显示。文字使用系统字体，未嵌入字体文件。

## 模块归属

| 模块 | 所有权 |
| --- | --- |
| `types.ts` | 几何、场景、笔迹、填充、预算和绘制结果的共享契约 |
| `geometry.ts` | SVG path 解析、基础图元、离散采样与几何缓存 |
| `generate.ts` | seed、按图元编排、预算累计；不选择具体笔迹 |
| `pens/` | 自然曲线、铅笔纤维、椭圆笔尖压感和彩漫明暗层 |
| `fills.ts` | solid、hachure、cross-hatch、zigzag、dots、dashed、zigzag-line |
| `decorations.ts` | 路径端点箭头和波浪线几何 |
| `renderers/` | SVG、Canvas，以及角色到颜色的解析 |
| `index.ts` | 唯一公开入口 |

Mermaid 布局提取、Rough.js 对照、彩漫场景、播放时钟和 React 状态属于消费方，不进入包。包不维护浏览器播放循环；调用方传入进度，可以暂停、恢复、跳转或取消。示例配置不是封闭的笔迹枚举。

## 外部笔迹与固定质量

实现 `Pen` 的 `id` 和 `generate(geometry, context)` 即可接入；返回后端无关的 `InkLayer[]`，不注册到核心，也不修改渲染器。`Fill` 遵循同样的生成接口。真实外部例子在站点的 `sketch-prototype/external/ribbon.ts`，只导入包根入口。

- `context.random(channel, index)` 提供按 seed 与图元 ID 派生的确定性随机数；换色和切换后端不重新生成笔墨。
- `context.sample` 计量采样，`context.budget.addCommands` 必须在构造输出时累计命令。预算是协作式约定，不能抢占任意外部同步 JavaScript，也不限制插件自行分配的内存。
- 默认命令预算 600000，采样预算 200000，采样 precision 为 0.3 场景单位。超限抛 `BudgetExceeded`，不返回半成品、不降密度、不放宽误差。
- 铅笔默认 7 条纤维、颗粒密度 0.35。二者是显式造型参数，运行中不会自动调节；提高它们可能超预算。
- 压感 profile 是宽度倍率，与笔尖旋转角度、长短轴比和颜色独立；默认曲线首尾提笔，闭合轮廓保持周期性。任意用户函数没有连续性/误差的全局数学保证。
- `evenodd` / `nonzero` 孔洞规则保留在填充和裁剪中。`Geometry.closed` 表示包含闭合命令，不保证复合路径中的所有子路径都闭合。
- `Geometry` 按不可变值使用；修改其 commands 或复用同一对象改变内容会使采样与 Path2D 缓存失效。

详细参数、单位和失败边界见各导出符号的 TSDoc。没有声称完整支持所有 SVG 文档特性；几何输入支持 SVG path 命令，DOM 适配器只覆盖实验页使用的 Mermaid flowchart。

## 构建与消费

在 `web/` 下运行：

```sh
pnpm --filter @violet/sketch typecheck
pnpm --filter @violet/sketch build
pnpm --filter @violet/sketch pack --pack-destination /tmp
```

源码使用显式 `.ts` 导入；TypeScript 开启 `allowImportingTsExtensions` 与 `rewriteRelativeImportExtensions`。Vite 生成 ESM，声明文件随 dist 交付，包的 `publishConfig.exports` 指向 dist。workspace 的源码导入通过不等于 tarball 消费已经验证。

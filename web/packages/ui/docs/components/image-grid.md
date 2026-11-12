# ImageGrid 图片网格

展示图片集合中的前四张缩略图。完整图片、灯箱、索引切换和预加载归宿主，不依赖站点路由或 react-tweet。

```tsx
import { ImageGrid } from "@violet/ui";

<ImageGrid
  images={[
    { src: "/photo-a-thumb.webp", alt: "傍晚的山谷", width: 1200, height: 800 },
    { src: "/photo-b-thumb.webp", alt: "湖边的树", width: 800, height: 1200 },
  ]}
  onImageClick={(index, thumbnail) => {
    openPreview(originalUrls, index, thumbnail, thumbnailUrls);
  }}
/>
```

完整样式入口为 `@violet/ui/styles.css`；按需加载先引入 `@violet/ui/tokens.css`，再引入 `@violet/ui/components/image-grid.css`。叶子 React 入口为 `@violet/ui/image-grid`。

## 数据与 DOM

- `images` 为只读的 `ImageGridImage[]`，每项包含 `src`、可选的 `alt`、`width`、`height`。尺寸必须描述源图的真实比例，未提供时单图在加载后读取 `naturalWidth/naturalHeight`。
- `onImageClick(index, thumbnail)` 的索引属于完整输入集合。第二参数始终是点击格子里可见的真实 `HTMLImageElement`，不是按钮、遮罩或复制节点。宿主可直接用作灯箱飞入起点。
- 根节点为 `div`，标准 DOM 属性、`className`、`style`、事件和 `ref` 原样归根节点。图片入口是原生 `type="button"`，不会提交外层表单；Enter、Space 与指针点击遵循浏览器原生行为。
- 每个按钮名称为「查看第 N 张，共 M 张」。图片 `alt` 描述内容，默认空字符串；数量遮罩对读屏隐藏。
- 空集合不输出节点。只挂载前四张 `<img>`，不会为了隐藏项下载完整集合。

## 布局与反馈

| 数量 | 布局 |
| --- | --- |
| 1 | 原图比例，最高 360px，宽度不超过容器；比例大于 16:9 时居中裁到 16:9。未获得尺寸前按 16:9 占位 |
| 2 | 左右等宽正方形 |
| 3 | 整体 4:3，左侧第一张跨两行，右侧上下两张 |
| 4 | 2×2，每格 4:3 |
| >4 | 与四张相同，第四张加 40% 黑色遮罩；显示 `+N`，N 为从第四张起尚可浏览的数量，即总数减三 |

间隙 2px，整个网格外圈圆角 12px，图像用 `object-fit: cover` 裁切。悬停亮度为 1.04，160ms 过渡；键盘聚焦以内描边表达，不缩放图片。系统减弱动态或祖先 `data-motion="reduce"` 时取消过渡。

## 站点编排边界

`shared/ui/image-grid` 持有本站 `useImagePreview` 与 `ImagePreview`，只做原图/缩略图映射和灯箱状态编排，布局使用此单元。评论、推文评论和推文卡片均复用该编排；缩略图继续使用等比例宽度变换，不用裁方缩略图代替原比例数据。第五张及之后虽然没有缩略格，仍保留在灯箱完整输入中，可顺序浏览。

`react-tweet` 是独立包，不反向依赖本单元。其嵌入推文内部媒体不在本站图片网格的迁移边界内。

## 验收边界

包内行为测试覆盖数量边界、真实图片回调、尺寸加载、宽图裁切比例、原生表单边界、DOM 属性与 ref。站点测试覆盖缩略图打开原图、隐藏项仍可浏览、评论等比例缩略图以及推文卡片不触发整卡导航。CSS 几何、明暗四季、窄屏和减弱动态由真实浏览器核对，不能以 jsdom 属性断言替代。

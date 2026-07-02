# 代码块滚动条美化设计

## 背景

前台文章详情页中的围栏代码块使用深色卡片背景 `bg-[#24292e]`，但滚动条保持浏览器默认样式，视觉上不够协调。

## 目标

为代码块的水平（及垂直兜底）滚动条提供细窄、圆角、暗色的自定义样式，与代码块深色背景协调。

## 设计决策

- **风格**：极简细线（GitHub 风格）。
  - 滚动条尺寸：6px
  - 轨道：透明
  - 滑块：`bg-white/15`，圆角
  - 悬停：滑块变 `bg-white/25`
- **实现方式**：在全局 `styles.css` 定义可复用工具类 `.code-block-scrollbar`，在 `CodeBlock.tsx` 的两个滚动容器上引用。
- **浏览器覆盖**：WebKit（Chrome/Safari/Edge）使用 `::-webkit-scrollbar-*`；Firefox 使用 `scrollbar-width` / `scrollbar-color`。

## 改动文件

1. `web/src/styles.css`：新增 `.code-block-scrollbar`。
2. `web/src/shared/ui/markdown-preview/components/CodeBlock.tsx`：给 `shiki-code` div 和降级 `pre` 加 `.code-block-scrollbar`。

## 验收标准

- 代码块出现滚动条时，样式为细窄圆角暗色。
- 悬停滚动条滑块时亮度提升。
- 现有 `HtmlContent` 回归测试继续通过。
- `pnpm typecheck` 与 `pnpm test` 无错误。

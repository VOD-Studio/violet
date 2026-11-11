# ScrollArea 滚动区域

`ScrollArea` 保留浏览器的原生滚动、方向键、触摸、滚轮和滚动恢复；覆盖式滑块不占布局空间。视口默认 `role="region"`、`tabIndex={0}`，因此必须通过 `aria-label` 或 `aria-labelledby` 命名。

```tsx
import { ScrollArea } from "@violet/ui";

<ScrollArea aria-label="章节目录" className="h-64">
  <ol>{chapters.map((chapter) => <li key={chapter.id}>{chapter.title}</li>)}</ol>
</ScrollArea>;
```

- `className` 控制外层尺寸；`ref`、`id`、`style`、原生事件和语义属性属于真正的滚动视口，`viewportClassName` 可调整视口布局。
- `orientation` 默认为 `vertical`；`horizontal` 与 `both` 在还能向左或向右滚动时出现翻页按钮，每次移动视口宽度的 80%。翻到头后按钮消失，焦点交给视口，键盘可以继续用方向键滚动。
- 6px 滑块在指针进入或滚动时用 150ms 出现；离开且停止滚动 800ms 后用 300ms 淡出。减弱动态下常显。滑块对读屏隐藏，可直接拖动。
- 四边 24px 渐隐只在对应方向仍有内容时显示，不做过渡。默认取页面纸色；放在纸片里时在外层设置 `--v-scroll-area-surface: var(--card)`。
- 视口保留 4px 内边距保护子控件焦点环。已有足够单元格内边距的表格可设置 `--v-scroll-area-padding: 0px`；不得因此裁掉可聚焦子项的外环。
- 视口在键盘聚焦时显示内描边；组合组件也可在后代聚焦时为整个视口绘制焦点环，不覆盖子控件自身的轮廓。
- 内容外层宽度与“宽 100% 的块”一致，只有放不下时才变宽；宽度为 100% 的表格仍按视口宽度排版。
- 滚动过程中只切换边缘装饰与翻页按钮的可见性，不插拔外围节点；嵌入拖拽排序等依赖祖先测量的内容时，不因滚动改变测量基准。

`DocumentScrollbar` 每个文档挂载一次，覆盖文档滚动条但不替换 `window` 滚动；弹层把 html 或 body 设为 `overflow: hidden` 时同步隐藏。宿主可在 SSR 的 `html` 上设置 `data-scrollbar="none"` 避免首帧滚动条占宽；卸载后恢复原属性。

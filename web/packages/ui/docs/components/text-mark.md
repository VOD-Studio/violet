# TextMark

静态荧光笔标记，用于搜索结果中实际命中的片段，不承担匹配、选区或点击行为。空结果中的查询回显不是命中，不使用此单元。

```tsx
import { TextMark } from "@violet/ui";

<p>从正文找到的<TextMark>设计</TextMark>片段。</p>
```

## 语义与边界

- 渲染原生 `mark`，接收其原生属性与 `ref`；文本仍由 React 转义。
- 不增加按钮语义、Tab 停靠点或动画；交互批注继续使用 `AnnotationMark`。
- 笔触继承当前作用域的 `--decoration`，文字继承所在段落的字号与颜色，不锁定春季粉色。
- 渐变表现笔触墨色浓淡，不使用包住整段的绝对定位背景。`box-decoration-break: clone` 为每行复制笔触；断词策略归容器决定，连续长词可由宿主设置 `overflow-wrap: anywhere`。
- 强制颜色模式改用下划线，不依赖背景色传达强调。

根入口为 `@violet/ui`，叶入口为 `@violet/ui/text-mark`；总样式使用 `@violet/ui/styles.css`，单独消费可导入 `@violet/ui/components/text-mark.css`。

原生 HTML 共用相同样式：`<mark class="v-text-mark">相关文字</mark>`。独立 tarball 消费预览的 `?preview=text-mark` 包含根入口、叶入口、HTML、多行与连续长词样本。

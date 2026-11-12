# Accordion

内容多、每次只看一部分时用：常见问题、设置分组。点标题展开或收起，展开时整项成一块凹陷色，内容跟在下面同一块底色里。几块内容平级、互相切换用 Tabs（只显示其中一块，切换不留痕迹）；内容有很多层用树；只是想收起一段文字，用这个单元就过重了。

```tsx
import { Accordion, AccordionItem } from "@violet/ui";

// 常见问题：可以同时展开多项
<Accordion>
  <AccordionItem value="review" title="评论需要审核吗？">
    首次评论需要审核，通过后同一账号不再审核。
  </AccordionItem>
  <AccordionItem value="repost" title="可以转载这里的文章吗？">
    可以，署名并附原文链接即可。
  </AccordionItem>
</Accordion>

// 设置分组：一次一项，收起时标题右侧写当前值
<Accordion type="single" value={open} onValueChange={setOpen}>
  <AccordionItem value="publish" title="发布设置" summary="立即发布 · 允许评论">
    …
  </AccordionItem>
  <AccordionItem value="repost" title="转载信息" summary="原创">
    …
  </AccordionItem>
</Accordion>
```

## API

两个部件：`Accordion` 管展开值，`AccordionItem` 是一项（标题、摘要与内容）。没有单独的 trigger / content 部件。

### Accordion

继承 `div` 的原生属性与 `ref`。

| 属性 | 作用 |
| --- | --- |
| `type` | `"multiple"`（默认）可同时展开多项；`"single"` 一次一项。类型随之收窄 |
| `value` / `defaultValue` / `onValueChange` | `multiple`：展开项 `value` 的 `string[]`，按展开先后排列；`single`：`string`，**空串表示全部收起**。受控时点击只回调新值，展开状态跟随 `value` |
| `headingLevel` | 标题的 h 级别，2 到 6，默认 3；按页面大纲选 |

### AccordionItem

继承 `div` 的原生属性（不含 `title`）与 `ref`；`className` 与其余属性落在项的外层 `div` 上。必须放在 `Accordion` 里，否则抛错。

| 属性 | 作用 |
| --- | --- |
| `value` | 项的标识，同一 `Accordion` 内唯一 |
| `title` | 标题行内容，也是按钮的可访问名称 |
| `summary` | 收起时显示在标题右侧的次级色一行，展开后隐藏；两种 `type` 都可用，设计稿只在 single 里演示。它在按钮里，所以读屏会把它读作按钮名称的一部分（「发布设置 立即发布 · 允许评论」） |
| `disabled` | 标题按钮原生 `disabled`：不可点、不在 Tab 顺序里，50% 透明度 |
| children | 内容，14 / 1.8，正文色的 82% |

## 键盘与读屏

| 部件 | 契约 |
| --- | --- |
| 标题 | `h3`（可改）里的原生 `button`，`aria-expanded` 表达展开，`aria-controls` 指向内容 |
| 内容 | `role="region"`，`aria-labelledby` 指回标题按钮；id 由 `useId` 生成，服务端首帧与水合一致 |
| Enter / Space | 展开或收起（原生按钮行为） |
| Tab | 顺序就是阅读顺序，每个标题都是一个 Tab 停靠点；**没有方向键在标题间移动**（设计稿未规定） |
| 收起的内容 | 内容常驻 DOM，用 `inert` 移出 Tab 顺序与读屏，聚焦环不会落到看不见的内容上；不另加 `aria-hidden` |

## 视觉与动效

标题行最小高 52、左右内边距 16、圆角 12，悬停与展开都是 `--muted` 凹陷色；标题 15 / 500，摘要 13 / 400 次级色；项间距 4，不画分割线。箭头 16，展开转半圈（旋转 180°）200ms，`cubic-bezier(.32,.72,0,1)`。

| 阶段 | 高度 | 内容透明度 |
| --- | --- | --- |
| 展开 | 280ms，`0fr → 1fr` | 200ms，延迟 60ms 淡入 |
| 收起 | 200ms，`1fr → 0fr` | 120ms 先淡出 |

不缩放、不滑入。减弱动态（系统偏好与 `[data-motion="reduce"]` 两个作用域）下所有过渡取消：直接展开收起，箭头瞬间翻转到位。

聚焦环：标题按钮的环画在标题行内侧（2px，`outline-offset: -2px`）；内容的裁剪层留 4px 内边距并用等量负外边距抵消，所以内容里的链接、输入框的聚焦环不被裁。

## 为什么不用 Radix Accordion

Radix 收起时卸载内容、用 `hidden` 属性隐藏，而设计稿要的是内容常驻、靠 `grid-template-rows` 做高度动画并 `inert`，收起动画期间内容也必须还在。Radix 默认的方向键在标题间移动设计稿也未规定。所以这里是基于原生 `button` 的自有实现，只借 `radix-ui/internal` 的 `useControllableState` 做受控与非受控。

## 状态与已知边界

- 受控值里出现没有对应 `AccordionItem` 的 `value`：不影响渲染，值照原样保留与回调。
- `single` 的受控值若给出不存在的项，所有项都显示收起。
- 内容常驻 DOM：内容里的重型子树在收起时也已挂载；需要懒挂载由调用方自己按展开值控制。
- 没有「全部展开 / 全部收起」、嵌套手风琴、拖动排序。

## 导入

React 从 `@violet/ui` 或 `@violet/ui/accordion` 导入；按需 CSS 使用 `@violet/ui/components/accordion.css`，不依赖其它单元样式。

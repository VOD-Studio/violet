## 批注显示单元

`AnnotationMark`、`AnnotationToolbar`、`AnnotationToolButton` 和 `AnnotationCardFrame` 提供原文标记、选区操作栏和 320px 纸片外壳。文章锚点、DOM Range、评论请求、登录、作者/AI 身份、页边头像筛选与编辑器均由宿主管理；包不依赖 comments feature。

```tsx
import {
  AnnotationMark, AnnotationToolbar, AnnotationToolButton,
  AnnotationCardFrame, Popover, PopoverTrigger, PopoverContent,
} from "@violet/ui";

<Popover>
  <PopoverTrigger asChild>
    <AnnotationMark aria-label="1 条批注：阅读，是相遇。">
      阅读，是相遇。
    </AnnotationMark>
  </PopoverTrigger>
  <PopoverContent asChild>
    <AnnotationCardFrame aria-label="批注内容">
      有时一句话，就能把陌生人的距离拉近。
    </AnnotationCardFrame>
  </PopoverContent>
</Popover>
```

### 原生语义与边界

- Mark 的根节点始终是 `mark`，`role="button"`，默认 `tabIndex=0`；必须提供 `aria-label`。Enter / Space 合成一次 click，重复按键不重复激活。调用方在 `onKeyDown` 中 `preventDefault()` 可以取消内部激活。
- Toolbar 是具名 `role="toolbar"` 的 div；按钮按正常 Tab 顺序访问，没有额外 roving-focus 状态。ToolButton 复用 Button，默认 `type="button"`，原生禁用、事件取消及 ref 不丢失。阻止按下时清空选区的 `onMouseDown` 由宿主选择性传入。
- CardFrame 是 div，不隐式声明 dialog、不移动焦点、不定位、不创建 Portal。与 Popover.Content 通过 `asChild` 组合时不新增 DOM 层，浮层角色、外部点击、Escape、焦点回退及挂载位置由 Popover 提供。宿主传入 `container` 可限定面板的挂载范围。
- 每个组件的原生属性、className、style 和 ref 都落在其唯一根节点。文章里由 DOM Range 动态生成的分段 mark 可继续使用业务笔触与委托事件；作者墨色、AI 配色不是库内变体。

### 外观与入口

React 从 `@violet/ui` 或 `@violet/ui/annotation` 导入。Tailwind 后加载 `@violet/ui/styles.css`；普通 CSS 消费先加载 `tokens.css`，再加载 `components/annotation.css`。BEM 类为 `v-annotation__mark`、`v-annotation__toolbar`、`v-annotation__tool`、`v-annotation__card`，工具按钮同时使用 Button 的 BEM 类。

工具栏为 150ms、4px 浮出；定位由宿主通过布局或 style 控制。纸片本身没有独立淡入，接入 `v-float` 后跟随浮层的 200/140ms 进退；引用内容不另播入场。减弱动态时工具栏与批注卡直接显示；`data-motion="reduce"` 支持检视台预览。颜色从所在作用域的语义 token 继承，荧光笔标记随四季变化。

普通正文强调用原生 `mark`，独立动作使用 Button，通用浮层使用 Popover；没有批注语境时不要套这套纸片和工具栏。需要保存锚点、提交评论或筛选作者时，在业务 feature 组合，不向单元追加接口与登录参数。

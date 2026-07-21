# 公式渲染白名单管线与弹层编辑
Status: accepted（2026-07-21），取代 ADR-0004 决策 4（双态编辑）

## 背景

ADR-0004 确定了浏览时渲染与双态编辑。落地后暴露两个问题：

1. **渲染注入**：KaTeX HTML 经 `dangerouslySetInnerHTML` 裸注入（阅读端 `MathFormula` + 编辑器 `MathView` 共 6 处）。KaTeX `trust:false` 输出本身安全（无脚本/事件处理器），但裸注入缺乏防御纵深；且存在远程导入路径（readability 抓取第三方站点文章），外部内容的公式源码可进入文档。
2. **编辑体验**：双态编辑选中后在正文内嵌「源码框 + 实时预览」，块级上源码下预览导致布局跳动，行内公式同行显示源码视觉怪异，实测不满。

## 决策

1. **渲染输出走 hast 白名单管线**：`renderKatex` HTML 字符串 → hast 解析 → `hast-util-sanitize`（KaTeX 专属白名单 schema：span / MathML / svg 子集标签 + class / style / aria-* 属性）→ `hast-util-to-jsx-runtime` 生成 React 元素。替换全部 `dangerouslySetInnerHTML`，零新依赖，SSR 同构，与 HtmlContent 同一管线模式。
2. **编辑交互改为弹层编辑（Popover Editing）**：文档内永远只显示渲染结果；点击选中弹出跟随定位的浮层（上方源码输入区、下方实时预览、语法错误内嵌提示），Esc / 点击外部关闭；行内与块级同一交互模式。取代 ADR-0004 决策 4。
3. **源码输入内置 LaTeX 自动补全**：输入 `\` 触发命令建议下拉（KaTeX 常用命令 + mhchem + 物理宏表合并清单），模糊匹配、键盘导航、插入后光标落在第一个占位符。不做符号工具栏。
4. **源码模式保持现状**：整篇纯 Markdown textarea，公式显示为 `$...$` 文本，不渲染、无弹层。

## 理由

- 白名单管线是真消毒：标签/属性白名单下即使渲染器输出被污染也无法注入事件处理器；且复用已有 hast 管线模式与依赖，SSR 同构（DOMParser 类方案在服务端不可行）。
- 弹层根除双态的布局跳动与行内怪异。ADR-0004 否决弹窗时的三个顾虑现状已变：滚动容器裁剪在 bubble menu 已解决，弹层内 input 焦点管理简单，编辑仍走 `updateAttributes` 同一撤销栈。
- 自动补全覆盖面（数百命令）远超符号工具栏（数十按钮），UI 不占地；不熟悉 LaTeX 的人输入即得提示，不需记忆命令位置。

## 代价

- 每个公式渲染多一次 hast 解析 + sanitize：公式 HTML 很短，成本可忽略；编辑器实时预览经 useMemo 按 latex 缓存。
- 弹层引入浮层定位与 dismiss 边缘 case：复用项目 floating UI（bubble menu）的既有方案。

## 已否决

- **`katex.render(ref)`**：不用 danger API，但 KaTeX 内部仍是 innerHTML，安全级别未变，换汤不换药。
- **DOMPurify + danger**：新增依赖，且仍是字符串注入，不如 hast 白名单贴合 React 模型。
- **MathML 输出 + 浏览器原生渲染**：视觉质量大幅回退（失去 KaTeX CSS 布局）。
- **符号工具栏**：覆盖面有限、UI 复杂度高；保留为未来增补。
- **Typora 纯源码模式**：无实时预览，对不熟悉 LaTeX 的人最不友好。
- **双态编辑（内联源码切换）**：布局跳动、行内显示怪异，本次被弹层编辑取代。

---
name: "Violet Public Frontend"
description: "真实个人创作、安静但有生命力的公开内容索引"
colors:
  coral-light: "oklch(0.625 0.19 25)"
  on-coral-light: "oklch(0.99 0 0)"
  coral-dark: "oklch(0.72 0.15 22)"
  coral-wash-light: "oklch(0.95 0.025 25)"
  coral-wash-dark: "oklch(0.25 0.025 22)"
  canvas-light: "oklch(0.985 0 0)"
  ink-light: "oklch(0.235 0 0)"
  paper-light: "oklch(1 0 0)"
  muted-surface-light: "oklch(0.96 0 0)"
  muted-ink-light: "oklch(0.5 0 0)"
  hairline-light: "oklch(0.895 0 0)"
  canvas-dark: "oklch(0.17 0 0)"
  ink-dark: "oklch(0.92 0 0)"
  panel-dark: "oklch(0.205 0 0)"
  muted-surface-dark: "oklch(0.235 0 0)"
  muted-ink-dark: "oklch(0.7 0 0)"
  hairline-dark: "oklch(0.92 0 0 / 12%)"
typography:
  display:
    fontFamily: '"Manrope Variable", "Noto Sans SC", "PingFang SC", sans-serif'
    fontSize: "2.25rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.035em"
  headline:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Noto Sans SC", "Microsoft YaHei", sans-serif'
    fontSize: "1.5rem"
    fontWeight: 500
    lineHeight: 2
    letterSpacing: "-0.02em"
  title:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Noto Sans SC", "Microsoft YaHei", sans-serif'
    fontSize: "0.95rem"
    fontWeight: 500
  body:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Noto Sans SC", "Microsoft YaHei", sans-serif'
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: "1.75rem"
  label:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Noto Sans SC", "Microsoft YaHei", sans-serif'
    fontSize: "0.75rem"
    fontWeight: 400
rounded:
  lg: "0.625rem"
  xl: "0.75rem"
  full: "9999px"
spacing:
  compact: "0.5rem"
  inline: "0.75rem"
  page-mobile: "1.25rem"
  page-tablet: "2rem"
  page-desktop: "3rem"
  section-compact: "3.5rem"
  section-medium: "5rem"
  section-large: "7rem"
  section-wide: "9rem"
components:
  button-primary:
    backgroundColor: "{colors.coral-light}"
    textColor: "{colors.on-coral-light}"
    rounded: "{rounded.full}"
    padding: "0.625rem 1.25rem"
  button-primary-dark:
    backgroundColor: "{colors.coral-dark}"
    textColor: "{colors.canvas-dark}"
    rounded: "{rounded.full}"
    padding: "0.625rem 1.25rem"
  social-pill:
    backgroundColor: "{colors.paper-light}"
    textColor: "{colors.muted-ink-light}"
    rounded: "{rounded.full}"
    padding: "0.5rem 0.875rem"
  social-pill-dark:
    backgroundColor: "{colors.panel-dark}"
    textColor: "{colors.muted-ink-dark}"
    rounded: "{rounded.full}"
    padding: "0.5rem 0.875rem"
  publication-row:
    backgroundColor: "{colors.canvas-light}"
    textColor: "{colors.ink-light}"
    typography: "{typography.title}"
    rounded: "{rounded.lg}"
    padding: "0.75rem"
  publication-row-hover:
    backgroundColor: "{colors.coral-wash-light}"
    textColor: "{colors.coral-light}"
    typography: "{typography.title}"
    rounded: "{rounded.lg}"
    padding: "0.75rem"
  tweet-bubble:
    backgroundColor: "{colors.muted-surface-light}"
    textColor: "{colors.ink-light}"
    rounded: "{rounded.xl}"
    padding: "0.625rem 0.75rem"
  activity-node:
    backgroundColor: "{colors.canvas-light}"
    textColor: "{colors.coral-light}"
    rounded: "{rounded.full}"
    size: "1.5rem"
  footprint-node:
    backgroundColor: "{colors.coral-light}"
    rounded: "{rounded.full}"
    size: "0.625rem"
  discovery-link:
    textColor: "{colors.muted-ink-light}"
    typography: "{typography.label}"
  avatar-desktop:
    backgroundColor: "{colors.muted-surface-light}"
    rounded: "{rounded.full}"
    size: "18rem"
  footer-mark:
    backgroundColor: "{colors.ink-light}"
    textColor: "{colors.canvas-light}"
    typography: "{typography.title}"
    rounded: "{rounded.lg}"
    size: "2.25rem"
---

# Design System: Violet 公开前台新视觉世界

## Overview

**Creative North Star: "安静生长的创作索引"**

“安静生长的创作索引”把 Violet 的公开前台视为一处由真实作者、真实内容和真实时间共同形成的个人空间。它不追求营销转化，也不借巨型刊头、杂志编排或仪表盘式卡片制造声量；身份介绍是序章，文章、笔记、推文、图集与系列按各自意图继续展开。

这个世界以浅色近白或深色柔和炭黑为底，只让暖珊瑚承担少量强调。层级主要来自字体重量、充足留白、轻边界、灰度头像和克制的表面明度差；小幅 spring 与悬停位移提供生命力，但不抢夺内容注意力。所有身份与发布信息来自站点配置或公开数据，缺失时收拢结构，不伪造头像、文案、指标或大块占位。

本规范定义全站共享的视觉基因，但不要求所有界面复刻首页。当前首页是已经完成终审的首个验证表达；其他界面按下述视觉方言逐步迁移，未迁移页面不得被描述为已经采用。

**Key Characteristics:**

- 中性浅／深底色与低占比暖珊瑚强调
- 真实配置与公开内容驱动，缺失数据时收拢而非填充
- 排版、留白、细线和小尺度 spring 形成层级
- 灰度圆形头像、轻量目录、时间轴与发布足迹构成首页已验证表达

## Colors

当前默认配色由暖珊瑚与中性层级组成；主题系统把外观模式与配色方案分离，同一时刻只允许一个品牌强调色发声。浅色和深色主题分别使用作用域 token，不用全局旧色板替代。

### Brand Accent

- **默认暖珊瑚**（`coral-light` / `coral-dark`）：默认方案用于作者名、链接悬停、焦点轮廓、时间轴节点、选择高亮和主动作。它的稀缺性让真实内容而非品牌色成为页面主体。
- **强调薄雾**（`accent-wash-light` / `accent-wash-dark`）：由当前强调色派生，只用于轻量 hover 表面与低强度强调，不扩张为大面积背景。

### Neutral

- **近白画布／柔和炭黑画布**（`canvas-light` / `canvas-dark`）：公开前台的整页基底。
- **主墨色**（`ink-light` / `ink-dark`）：标题、正文和关键标识，避免纯黑纯白造成过硬反差。
- **纸面／深色面板**（`paper-light` / `panel-dark`）：头像底、社交入口和少量独立表面。
- **静音表面与静音文字**（`muted-surface-light`、`muted-surface-dark`、`muted-ink-light`、`muted-ink-dark`）：推文气泡、日期、说明和次级路径。
- **发丝边界**（`hairline-light` / `hairline-dark`）：首屏承接线、时间轴、页脚分隔和控件边缘。

### Named Rules

**The One Accent Voice Rule.** 每套配色在同一界面只使用一个品牌强调色；暖珊瑚是默认值，不与其他装饰色竞争。该限制不取代 danger、warning、success 等行为语义色，也不约束实验室的独立原型。

### Theme Model

- **外观模式（Appearance）**：`system / light / dark`，只决定明暗环境。
- **配色方案（Palette）**：官方预设或 `custom`，只决定品牌强调色，不与外观模式绑定。
- **自定义强调色（Custom Accent）**：用户只提供一个颜色种子；系统派生 hover、薄雾、焦点环和强调色上的前景色，并拒绝不满足对比度的结果。
- **受控语义色（Controlled Semantic Colors）**：画布、正文、表面层级及 danger、warning、success 等行为语义色不开放任意编辑，避免内容可读性和状态含义被主题破坏。

### Theme Persistence

- 匿名访客的 Appearance、Palette 与 Custom Accent 写入版本化 Cookie；SSR 直接读取，首帧不得先显示站点默认色再水合切换。
- 登录用户的偏好同时写入账号与 Cookie。登录时账号已有偏好则账号优先；账号尚无偏好时，把当前匿名选择升级为账号偏好。
- 用户没有任何偏好时使用站点管理员配置的默认方案；仅当 Appearance 为 `system` 时，再由操作系统决定实际明暗。

### Current Migration Scope

本轮只建立可扩展的 theme 接口、样式所有权、视觉方言与暖珊瑚默认适配，并逐页完成视觉迁移；不新增配色选择器、账号字段、API 或自定义颜色功能。多预设与自定义强调色作为后续独立 feature 接入同一接口，不要求本轮调用方再次改造。

### Style Ownership

- `web/src/styles.css` 是唯一全局入口，不再作为所有样式的实现文件；它只负责导入 Tailwind、字体和下列全局样式层。
- 全局 theme 映射、基础语义 token、配色预设、视觉方言和页面转场分别归属 `web/src/styles/` 下的独立文件，避免无关改动共享同一维护热点。
- 组件专属布局、动效与装饰就近放在组件旁的 `*.module.css`；不得因复用可能性而提前提升到全局。
- 富文本、编辑器文档树等必须匹配运行时生成 DOM 的规则，由对应 feature 持有 scoped stylesheet 或 CSS Module 的 `:global(...)` 入口，不回流到全局杂项文件。

### Control Semantics

- 共享控件只保留一套行为接口；公开前台与后台不得复制两套 Button、Input 或表单状态实现。视觉差异通过方言 token 与既有 semantic variant 表达。
- **品牌强调色（Brand Accent）**用于焦点、选中、当前导航、链接和进度；它跟随官方预设或用户自定义强调色。
- **主要动作色（Primary Action）**按方言映射：公开内容与登录入口使用品牌强调色，工具语言使用高对比中性色，避免后台大量操作形成彩色噪音。
- **行为状态色（Behavioral Status）**中的 destructive、warning、success 保持固定语义，不跟随配色方案；调用方不得用 `className` 把普通按钮临时染成状态按钮。

### Theme Acceptance

- 每个正式方言至少在 `390 × 844` 移动视口与 `1440 × 900` 桌面视口验收，覆盖 `light / dark / system`，不得出现横向溢出、主题水合闪烁或由字体与 token 切换引起的布局偏移。
- 默认方案、每套官方预设和自定义强调色边界样本都必须走同一视觉回归矩阵；不能只验证暖珊瑚后宣称主题系统成立。
- 普通文字对比度至少为 `4.5:1`，大字号文字、控件边界和焦点指示至少为 `3:1`；颜色不是错误、成功、选中或禁用状态的唯一提示。
- 自定义颜色无法同时派生出浅色与深色主题的合法强调前景时，拒绝保存并保留上一个有效方案，不静默降级为不可读颜色。
- `prefers-reduced-motion` 下取消方向性位移与装饰循环，但保留状态变化和焦点反馈。
- CI 保留一条薄真实浏览器契约：每种正式方言选择一个真实页面，验证计算后的 semantic token、主题首帧、关键控件状态和横向溢出；不维护整页像素快照基线。

### Visual Dialects

**视觉方言（Visual Dialect）**：同一套品牌基因在不同任务场景中的适配表达。全站共享色彩关系、排版尺度、圆角、边界和动效原则，但不共享固定布局与信息密度。

- **公开内容语言（Public Content Dialect）**：首页、博客、系列、图集、人设、友链、About 与登录／注册等公开入口强继承首页，以单一品牌强调色、近白／炭黑画布和宽松内容节奏为主。
- **工具语言（Tool Dialect）**：后台、编辑器、设置、个人中心与聊天保留相同品牌基因，但采用更高信息密度、更明确的边界和完整语义状态。
- **沉浸语言（Immersive Dialect）**：灯箱、媒体查看器与图表舞台使用中性舞台，让内容优先，只在控件反馈中克制地保留品牌色。
- **实验豁免（Lab Exemption）**：`/lab/*` 可以探索不同视觉方向，不纳入正式方言的一致性验收，也不得反向改写全站 token。

除非具体小节另有说明，本文后续布局与组件规则描述的是公开内容语言，不直接套用到工具语言或沉浸语言。

## Typography

**Display Font:** Manrope Variable（回退到 Noto Sans SC、PingFang SC 与 `sans-serif`）<br />
**Body Font:** 系统无衬线栈（优先 Apple 系统字体与 Segoe UI，中文回退到 PingFang SC、Noto Sans SC、Microsoft YaHei）<br />
**Label/Mono Font:** 无独立等宽标签字体；日期沿用正文栈并启用等宽数字。

**Character:** Manrope 只为身份标题提供清晰、亲近的轮廓，中文内容继续使用熟悉的系统无衬线。字阶不做刊物式戏剧化跳跃，以中等字重、短行和稳定数字节奏维持可读性。

### Hierarchy

- **Display**（600，基础 `2.25rem`，`1.25` 行高）：只用于首页身份句；在 `sm` 增至 `3rem`、在 `lg` 增至 `3.75rem`，保持紧凑字距。
- **Headline**（500，`1.5rem`，`2` 倍行高）：用于“最近文章”“最近动态”“发布足迹”等区段标题。
- **Title**（500，`0.95rem`）：用于发布目录中的内容标题；单行截断让日期始终保持稳定位置。
- **Body**（400，`1rem`，`1.75rem` 行高）：用于身份简介，正文行宽限制在约 `52ch`；次要说明使用 `0.875rem`。
- **Label**（400，`0.75rem`，等宽数字）：用于发布日期、活动类型和年份，不使用全大写装饰标签。

### Named Rules

**The Personal Scale Rule.** 展示字体只服务作者身份锚点；内容区标题保持中等尺度，不用巨型刊头、编号或全大写标签模拟杂志与简报。

## Layout

页面使用居中的 `80rem` 最大内容宽度。水平内边距从移动端 `1.25rem`，在 `sm`（`40rem`）增至 `2rem`，在 `lg`（`64rem`）增至 `3rem`；这些断点只在内容关系需要改变时介入。

首屏有真实头像时在 `lg` 形成两列，最小高度 `24rem`、列间距 `6rem`；无头像时自动收拢为最大 `42rem` 的居中单栏。最近发布贴在首屏底部的发丝分隔线上，直接承接后续内容。最近文章与最近动态在 `lg` 成为等宽双栏，移动端恢复单列并保留 `4rem` 栏间呼吸。

纵向节奏刻意宽松：首屏基础上下留白 `3.5rem`，主体起始留白 `5rem`，发布足迹与发现区使用 `7rem`；在大屏上分别扩展到 `4.5rem`、`7rem` 与 `9rem`。十二个月足迹保留 `48rem` 最小宽度，小屏通过水平滚动而不是压扁月份和节点。

## Elevation & Depth

系统平面优先，深度不是布局骨架。分区主要依靠空白、细线和中性色阶；阴影只出现在需要触感的社交胶囊、RSS 主动作与圆形头像上。头像使用宽而低透明度的环境阴影，暗色主题提高黑色阴影不透明度以维持轮廓；普通内容行和时间轴在静止时不悬浮。

### Shadow Vocabulary

- **轻触阴影**（`shadow-sm`）：社交胶囊与 RSS 动作的静止状态，只提示可交互性。
- **悬停阴影**（`shadow-md`）：RSS 动作悬停时短暂增强，不成为永久卡片阴影。
- **头像环境阴影**（`shadow-xl`，浅色黑色透明度 `5%`、深色 `20%`）：只用于真实灰度头像，和圆形裁切共同建立身份锚点。

### Named Rules

**The Flat at Rest Rule.** 内容表面默认平放；只有明确可交互的胶囊、主动作和身份头像可以获得阴影，列表与区段不得被包成等权悬浮卡片。

## Shapes

形状语言由三档真实圆角组成：一般内容行和品牌方块使用轻柔 `lg`，推文气泡使用 `xl` 并把左上角收紧，社交入口、主动作、头像与时间节点使用 `full`。细边框只负责定义触点和时间关系，不围合整段内容。

圆形用于身份和时间信号，圆角矩形用于一条可操作内容；二者都保持低厚度。不得把每个区块再套入大圆角、厚边框、阴影齐全的外壳，也不引入斜切、票据、终端面板或刊物编号作为这套世界的默认轮廓。

## Components

组件总体是“克制而有触感”：静止时融入内容流，hover、focus-visible 或真实数据关系出现时才显露强调。

### Buttons

- **Shape:** RSS 主动作与社交入口均为完整胶囊（`full`）；没有方形营销 CTA。
- **Primary:** 暖珊瑚底配对应主题前景，内边距 `0.625rem 1.25rem`，只在配置了 RSS 时出现。
- **Hover / Focus:** 主动作上移 `0.125rem` 并从轻触阴影过渡到悬停阴影；焦点使用 `2px` 暖珊瑚轮廓与 `4px` 外偏移。减弱动效时取消位移过渡。
- **Secondary / Ghost:** 社交入口为纸面色、发丝边框与静音文字，内边距 `0.5rem 0.875rem`；hover 轻微上移并将边框与文字转为暖珊瑚。

### Cards / Containers

- **Corner Style:** 发布目录行使用 `lg`，推文气泡使用 `xl` 并把左上角收为较小圆角。
- **Background:** 发布行静止时与画布同色，hover 才进入珊瑚薄雾；推文使用静音表面。
- **Shadow Strategy:** 内容行和推文气泡无阴影，遵守平面优先规则。
- **Border:** 目录分组只用顶部发丝线；不使用完整卡片边框。
- **Internal Padding:** 发布行 `0.75rem`；推文气泡 `0.625rem 0.75rem`。

### Navigation

首页发现导航把图标与自然中文名称平铺成可换行路径，hover 上移 `0.25rem` 并转为暖珊瑚；页脚链接只做颜色转变。现有 Header 继续作为兼容边界，不从本轮首页反推或重写其桌面、移动布局与状态样式。

### Identity Portrait

头像只来自站点配置或已配置 GitHub 用户名对应的公开头像，采用圆形裁切、灰度图像、发丝边框和环境阴影。尺寸从移动端 `14rem`、`sm` 的 `16rem` 到 `lg` 的 `18rem`；没有可用头像时整个右栏消失，不渲染占位图。

### Activity Timeline & Release Footprint

最近动态使用 `1px` 纵向发丝线、`1.5rem` 圆形节点和真实发布时间串联发布与推文；推文内容进入小气泡，其他内容保留文字链接。发布足迹把最近十二个月映射为珊瑚圆点列，每月最多展示六个可聚焦发布点；hover 或 focus 将点放大到 `1.5` 倍，同时保留隐藏的真实标题作为可访问名称。

## Do's and Don'ts

### Do:

- **Do** 让真实作者配置、公开内容和发布时间决定版面，并在数据缺失时收拢对应区域。
- **Do** 用暖珊瑚只标记身份、动作、焦点和时间节点，用中性色与留白承担其余层级。
- **Do** 保持浅色与深色主题、键盘焦点、触摸布局和 `prefers-reduced-motion` 的完整表达。
- **Do** 把首页视为已验证表达，并将同一视觉原则逐页迁移到未来公开前台，而不是宣称全仓库已经完成换装。

### Don't:

- **Don't** 在这套新公开前台世界中加入紫色、霓虹色或多强调色竞争。
- **Don't** 使用巨型刊头、杂志／简报式编号、Swiss-editorial 排版、终端面板或仪表盘卡片网格。
- **Don't** 伪造头像、作者故事、发布指标、推荐语、占位内容或与真实创作无关的大幅图片。
- **Don't** 在设计文档中记录未由 Violet 当前实现验证的组件、代码或品牌资产。
- **Don't** 把未修改的 Header 描述为本轮新设计产物，或借本规范承诺重写它。

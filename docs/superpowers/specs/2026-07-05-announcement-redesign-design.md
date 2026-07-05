# 公告模块重新设计（卡片 + 详情页去赛博化）

- **日期**: 2026-07-05
- **范围**: 前端 `web/`，仅公告模块的 `card` 与 `article` 两种 display 形态
- **不在范围**: `banner`（顶部多面体公告条，刚重构完）、其他模块（PostCard / TOC / steps / cursor / Footer / empty 等仍保留 neon 引用）
- **可预览原型**: `/announcement-lab`（已在本次提交中更新）

## 1. 背景与问题

当前公告模块（card + article）有以下问题：

1. **风格割裂**：卡片用 neon 赛博色板 + SpotlightCard 聚光 + DecryptedText 解码；详情页（`announcements.$id.tsx`）却用 hex 颜色 + 「事件简报 Event Manifest」终端字体。两者视觉语言不统一。
2. **过度装饰**：DecryptedText 解码动画、SpotlightCard 鼠标聚光、ClickSpark 点击粒子，三者叠加在一张卡片上，干扰阅读。
3. **详情页用 hex 而非 token**：`SEVERITY_COLOR`（`announcements.$id.tsx:19-24`）硬编码 `#3b82f6` 等，未走设计系统，暗色态下不可控。
4. **方向决定**：用户明确「不要赛博风」，并且删除赛博风相关文档。

## 2. 目标

- 公告卡片与详情页采用统一、克制的中性视觉语言。
- 仍保留质感与微交互（不退回裸 HTML），但来源换成非赛博风的 react-bits 组件。
- severity 配色改走 shadcn 友好的色阶，与项目其他组件（Badge / DataTable）一致。
- 删除公告模块内对赛博风专属资产的依赖。

## 3. 非目标（明确排除）

- 不动 banner 多面体公告条。
- 不删 `web/src/styles.css` 里的 `--neon-*` token（仍被 PostCard / TOC / steps / cursor / Footer / empty / SpotlightCard 内部消费，删除会破坏其他模块）。
- 不改后端 API、数据模型、admin 后台表单（`AnnouncementSheet`）。
- 不改 `Announcement` 类型定义。

## 4. 组件选型

### 4.1 引入的新 react-bits 组件

通过 `pnpm dlx shadcn@latest add @react-bits/<Component>-TS-TW` 安装，源码 vendor 到 `web/src/shared/vendor/react-bits/`：

| 组件 | 路径 | 用途 | 替代物 |
|---|---|---|---|
| `BorderGlow` | `BorderGlow.tsx` | 卡片容器，柔色发光描边随光标流动 | 替代 `SpotlightCard`（聚光） |
| `BlurText` | `BlurText.tsx` | 标题按词模糊渐显入场 | 替代 `DecryptedText`（解码乱码） |
| `Counter` | `Counter.tsx` | 公告 ID 数字滚动 | 新增（替代静态 `#001`） |
| `Magnet` | `Magnet.tsx` | 详情页按钮磁吸微交互 | 替代 `ClickSpark`（点击粒子） |
| `AnimatedList` | `AnimatedList.tsx` | 详情页事件时间轴，支持点击/键盘选择 | 替代静态 timeline 文本块 |

### 4.2 移除的赛博风组件（仅在公告模块内不再引用）

- `DecryptedText`（卡片标题、详情页标题、empty 状态——其中 empty 不属于本次范围，保留）
- `SpotlightCard`（卡片外壳——**保留组件文件本身**，因为 `PostCard` 还在用）
- `ClickSpark`（详情页 acknowledge 按钮——组件文件保留，仅公告不再引用）

> **注意**：以上三个组件**只移除公告模块内的 import**，不删除 vendor 源文件。`SpotlightCard` 仍被 `PostCard` 使用，删除会破坏文章卡片。

### 4.3 已安装但不采用的组件

- `FluidGlass`（依赖 three.js + .glb 模型，是 3D demo，非通用容器）——**已删除源文件**
- `SplitText`（依赖 GSAP 商用 SplitText 插件 + `@gsap/react`，授权风险）——**已删除源文件**

## 5. 视觉规范

### 5.1 severity 配色映射（去 neon，统一 shadcn 色阶）

替换 `AnnouncementCard.tsx:27-52` 与 `announcements.$id.tsx:19-24` 的两套映射为**单一来源**：

```ts
// 新增：web/src/features/admin-announcements/ui/severity.ts
// （或 shared 层，供 card 与详情页共用）
interface SevCfg {
  badge: string;   // 药丸徽章 class
  dot: string;     // 圆点 class
  glow: [string, string, string]; // BorderGlow 用 HSL 三元组
  Icon: ComponentType<{ className?: string }>;
  label: string;   // 中文标签
}

const SEV: Record<AnnouncementSeverity, SevCfg> = {
  info:    { badge: "bg-blue-500/10 text-blue-600 dark:text-blue-400",    dot: "bg-blue-500",    glow: ["217 91 60","217 91 60","217 91 60"],    Icon: Info,         label: "信息" },
  warning: { badge: "bg-amber-500/10 text-amber-600 dark:text-amber-400", dot: "bg-amber-500",   glow: ["38 92 50","38 92 50","38 92 50"],      Icon: TriangleAlert,label: "警告" },
  success: { badge: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400", dot: "bg-emerald-500", glow: ["152 76 40","152 76 40","152 76 40"],  Icon: CircleCheck,  label: "成功" },
  error:   { badge: "bg-red-500/10 text-red-600 dark:text-red-400",       dot: "bg-red-500",     glow: ["0 84 60","0 84 60","0 84 60"],          Icon: CircleX,      label: "错误" },
};
```

消除「card 用 neon / 详情页用 hex」的双轨。

> `glow` 三元组刻意三色相同（同 severity 单色），不使用多色 mesh 渐变——避免边框花哨、保持克制中性。BorderGlow 的 `colors` prop 支持多色 mesh，但本次只用单色模式。

### 5.2 字体

- 公告卡片与详情页正文、标题、metadata **统一用默认无衬线字体**（`font-sans`，不再加 `font-mono`）。
- 唯一保留等宽字的位置：`#001` 编号（`font-mono` 数字、tabular-nums），保证视觉锚点。
- 移除装饰文案：`── timeline ──`、`── body ──`、`EVENT #001`、`[info]`、`opened/window/status` 等终端日志风文案。

### 5.3 卡片布局（AnnouncementCard 重写）

`web/src/features/admin-announcements/ui/AnnouncementCard.tsx` 重写：

- 外壳：`<BorderGlow backgroundColor="hsl(var(--card))" borderRadius={16} glowColor={cfg.glow[0]} colors={...} glowIntensity={0.6} glowRadius={20}>`
- article 形态保留封面图（顶部 `aspect-2/1`，hover `scale-105`）。
- card 形态无封面，结构与 article 共用 `<body>`。
- 顶部行：左 severity 药丸徽章（`Icon + label`），右 `#<Counter value={id} fontSize={12} />`。
- 标题：`<BlurText text={title} animateBy="words" />`（不再 DecryptedText）。
- 摘要：`<p className="line-clamp-2">{excerpt || content}</p>`。
- affects：灰底 chip 标签（保留现状的 `bg-muted` 样式）。
- 底部行：左时间戳、右「阅读 →」（article 可点击）/「通知」（card 不可点击，去掉原 `standalone` 文案）。
- article 整卡 `<Link>` 包裹，card 不可点击——**交互边界与现状一致**，仅视觉换皮。

### 5.4 详情页布局（announcements.$id.tsx 重写）

`web/src/routes/announcements.$id.tsx` 重写：

- 移除「事件简报 Event Manifest」终端定位文案，改为常规详情页语义。
- header：severity 药丸徽章 + ACTIVE/INACTIVE 脉冲圆点 + `<BlurText>` 标题。
- **时间轴用 `<AnimatedList>`**：把 `opened/window/status` 等节点变成可交互列表项，支持 ↑↓ 键盘导航与点击高亮。初始选中第一项，下方显示「当前选中：第 X 条 / 共 N 条」。
- affects 标签：与卡片一致的灰底 chip。
- 正文：保留 `<ArticleContent>` 渲染 `content_html || content_md || content`。
- footer：
  - 「确认已读」按钮包 `<Magnet>`（替代 ClickSpark）。
  - 「复制事件 ID」按钮保留复制交互（去掉赛博文案）。
  - 「返回」链接。
- 错误/加载态：保留骨架与「公告不存在」回退。

## 6. 文件改动清单

### 6.1 修改

| 文件 | 改动 |
|---|---|
| `web/src/features/admin-announcements/ui/AnnouncementCard.tsx` | 重写：去 SpotlightCard/DecryptedText，换 BorderGlow/BlurText/Counter；severity 映射换 shadcn 色阶；去 `font-mono`/装饰文案 |
| `web/src/routes/announcements.$id.tsx` | 重写：去 DecryptedText/ClickSpark，换 BlurText/Magnet/AnimatedList；severity hex 改 shadcn 色阶；去终端文案 |
| `web/src/routes/announcement-lab.tsx` | 已在原型阶段更新（保留三种方案对比 + 详情页预览） |

### 6.2 新增

| 文件 | 说明 |
|---|---|
| `web/src/shared/vendor/react-bits/BorderGlow.tsx` | 已装 |
| `web/src/shared/vendor/react-bits/BlurText.tsx` | 已装（已修 `import type`） |
| `web/src/shared/vendor/react-bits/Counter.tsx` | 已装 |
| `web/src/shared/vendor/react-bits/Magnet.tsx` | 已装（已修 `import type`） |
| `web/src/shared/vendor/react-bits/AnimatedList.tsx` | 已装（已修 `import type`） |
| severity 配置模块（`web/src/features/admin-announcements/ui/severity.ts` 或 shared 层） | 单一 severity → 配置映射，供 card 与详情页共用 |

### 6.3 删除

| 文件 | 说明 |
|---|---|
| `web/src/shared/vendor/react-bits/FluidGlass.tsx` | 已删（依赖 three.js，不采用） |
| `web/src/shared/vendor/react-bits/SplitText.tsx` | 已删（依赖 GSAP 商用插件，不采用） |

### 6.4 不动（明确保留）

- `web/src/shared/vendor/react-bits/DecryptedText.tsx`（empty.tsx 仍用）
- `web/src/shared/vendor/react-bits/SpotlightCard.tsx`（PostCard 仍用）
- `web/src/shared/vendor/react-bits/ClickSpark/`（仅保留源文件，公告不再引用）
- `web/src/styles.css` 的 `--neon-*` token（其他模块仍消费）
- `web/src/widgets/AnnouncementBar/`（banner 不在范围）
- `web/src/widgets/AnnouncementLab/`（保留作原型参考；其内部 neon 引用属于历史原型，不清理）

## 7. 文档清理

用户要求删除赛博风相关文档。以下文档与本次去赛博化方向冲突，按"独立组件/独立提交"原则单独提交删除：

- `docs/superpowers/plans/2026-06-23-nexus-blog-ui-redesign.md`（赛博双主题源文档）
- `docs/superpowers/plans/2026-06-22-blog-frontend-mvp.md`（赛博/react-bits 落地计划）
- `docs/superpowers/specs/2026-06-22-blog-frontend-design.md`（赛博设计 spec）
- `docs/superpowers/plans/2026-06-26-frontend-redesign.md`（Aurora 赛博风）
- `docs/superpowers/specs/2026-06-26-frontend-redesign-design.md`（Aurora 赛博 spec）

> 不删 `CONTEXT.md`（项目主索引，仅修订其中第 108/112/120 行的公告形态与 react-bits 清单描述——这部分作为 spec 落地后的独立 commit）。

## 8. 风险与缓解

1. **历史 revert 教训**：`eaa1a11` 显示曾有一次"彻底去赛博"被整体回滚。本次**范围严格限定在公告模块**，不动 neon token 与其他模块，避免重蹈覆辙。
2. **AnimatedList 内部硬编码深色**（`#111`/`#120F17`）：详情页时间轴使用时需通过 `itemClassName` 覆盖背景为透明，否则浅色主题下会出黑底。原型已验证可行（`itemClassName="!bg-transparent !p-0"`）。
3. **BorderGlow 默认深色背景**：必须显式传 `backgroundColor="hsl(var(--card))"`，否则浅色态会变黑底。原型已验证。
4. **Counter 字号**：默认 `fontSize=100`，卡片场景必须传小字号（如 `fontSize={12}`），否则 ID 数字撑爆徽章。
5. **commit 拆分**：遵循项目 AGENTS.md 的原子性规范——vendor 组件新增、severity 模块提取、卡片重写、详情页重写、文档清理各自独立 commit（见 §9）。

## 9. 提交拆分预案

按 AGENTS.md「独立组件单独提交」「前后端分离」「同层按职责拆分」原则：

1. `chore(web): vendor 引入 BorderGlow/BlurText/Counter/Magnet/AnimatedList`（含 `import type` 修正）
2. `refactor(web): 移除未采用的 FluidGlass/SplitText vendor 组件`（含 three.js 依赖说明）
3. `refactor(web): 提取公告 severity 配置为共享模块`（severity.ts，去 neon 双轨）
4. `feat(web): AnnouncementCard 改用 BorderGlow + BlurText`（卡片重写）
5. `feat(web): 公告详情页改用 BlurText + AnimatedList + Magnet`（详情页重写）
6. `docs: 删除赛博风设计文档`（5 份 plans/specs）
7. `docs: 更新 CONTEXT.md 公告形态描述`（最后同步）

> 实际提交时按 `writing-plans` 生成的实施计划执行；本预案仅说明拆分意图。

## 10. 验收标准

- `/announcement-lab` 三段（卡片对比、详情页预览、历史 banner）正常渲染。
- 首页 `<AnnouncementGrid>` 渲染的 card / article 卡片无 neon 色、无解码动画、无聚光。
- `/announcements/:id` 详情页时间轴可点击、可键盘 ↑↓ 导航、标题模糊渐显、按钮磁吸。
- `pnpm typecheck` 通过（`HtmlContent.tsx` 预存在错误不计）。
- `pnpm lint`（Biome）通过。
- 暗色态下卡片与详情页配色正常（severity 走 `dark:` 变体）。

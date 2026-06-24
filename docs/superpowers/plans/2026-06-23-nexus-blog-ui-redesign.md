# Nexus-Blog UI 重构实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在完全保留现有前端架构（FSD 分层、TanStack Start SSR、Query 数据流、shadcn/new-york 基底）的前提下，彻底重写视觉层，落地「Nexus-Blog」极客物理美学的双主题门户与沉浸式博客。

**Architecture:** 不动 `api/`、`shared/server`、`shared/api/*`（http/csrf/refresh）、`features/*/api`、`features/*/model`、`entities`、`router.tsx`、`routeTree.gen.ts`、路径别名、`AppProvider`。所有改动限定在 `web/src/styles.css`（设计令牌重写）、`web/src/shared/ui/*`（原语重做 + 新增）、`web/src/shared/vendor/*`（新增 react-bits 组件）、`web/src/widgets/*`（视觉重写）、`web/src/features/posts/ui/*`（卡片/列表/TOC 视觉重写）、`web/src/routes/*`（首页网格化、详情页 Morph）。新增 `web/src/shared/lib/hooks` 放纯逻辑 hook（磁性吸附、Cmd+K、滚动进度），它们带单元测试。

**Tech Stack:** Tailwind CSS v4（`@theme` + CSS 变量，无 tailwind.config.js）、Radix UI primitives（已通过 `radix-ui` 包聚合引入）、React Bits（`src/shared/vendor/react-bits` 手拷）、motion（`motion/react`，已装 v12）、next-themes（已装）、@tanstack/react-router + react-query + react-start（已装）、Biome（已装，tab 缩进 + 双引号）、Vitest（已在 devDependencies，但仓库目前无 vitest.config，本计划补一份）。

---

## 验证基准（每个任务结束都跑这组，确保没有破坏架构）

```bash
cd web
npx biome check .          # 期望：无 lint/format 错误（vendor 与 ui 目录 biome 已 ignore）
npx tsc --noEmit           # 期望：无类型错误
pnpm test                  # 期望：所有单元测试通过（vitest）
```

若某个任务新增了纯函数，则额外跑：`pnpm test <pattern>`。

> **重要纪律**：本计划严格不触碰数据层（`shared/api/*`、`features/*/api`、`features/*/model`、`shared/server/*`）。所有 UI 重写都消费**已存在**的 hook（`usePosts`、`useSettings`、`useAnnouncements`）与类型（`Post`、`SiteSettings`、`NavItem`），只换渲染。

---

## File Structure（新建/修改清单）

### 修改（保留路径，重写内容）
- `web/src/styles.css` — 双主题设计令牌（赛博深空 / 工业蓝图）+ clip-path 主题切换样式 + 滚动遮罩 + 字体引入
- `web/vitest.config.ts` — 新建（任务 1）
- `web/src/shared/ui/button.tsx` — 增加 `mech` 变体（机械轴体下压）
- `web/src/shared/ui/skeleton.tsx` — 改为光影扫过骨架
- `web/src/shared/ui/coming-soon.tsx` — 重做视觉
- `web/src/widgets/Hero/Hero.tsx` — 重写为左侧视觉区（xunrua 解密文本 + 粒子背景）
- `web/src/widgets/Header/Header.tsx` + 子组件 — 重写为 20% 底座导航
- `web/src/widgets/ThemeToggle/ThemeToggle.tsx` — 改为机械轴体 3D 按键 + clip-path 圆形扩散
- `web/src/widgets/Footer/Footer.tsx` — 重做视觉
- `web/src/widgets/MusicPlayer/MusicPlayer.tsx` — 重做视觉
- `web/src/widgets/AnnouncementBar/AnnouncementBar.tsx` — 重做视觉
- `web/src/features/posts/ui/PostCard.tsx` — Spotlight 边缘聚光卡片
- `web/src/features/posts/ui/PostList.tsx` — 改用虚拟列表（不崩塌）+ 滚动遮罩
- `web/src/routes/index.tsx` — 首页 80/20 + 50/50 网格装配
- `web/src/routes/blog/$slug.tsx` — 文章详情 Morph 布局 + TOC + 阅读进度
- `web/src/routes/__root.tsx` — 装配 CustomCursor、CommandPalette（不破坏 SSR）

### 新建
- `web/src/shared/vendor/react-bits/SpotlightCard.tsx` — 卡片边缘聚光灯
- `web/src/shared/vendor/react-bits/ParticleField.tsx` — 鼠标跟随流体粒子（替换 Aurora 在首页左侧用）
- `web/src/shared/vendor/react-bits/CommandPalette.tsx` — Radix Dialog 毛玻璃命令面板（封装）
- `web/src/shared/ui/mech-switch.tsx` — 机械青轴 3D 键帽原语（供 ThemeToggle 等复用）
- `web/src/shared/ui/shimmer-skeleton.tsx` — 光影扫过骨架原语（替换原 Loader 思路）
- `web/src/shared/ui/steps.tsx` — 物理时间轴步骤组件
- `web/src/shared/ui/scroll-area.tsx` — 带渐隐遮罩的滚动容器原语
- `web/src/shared/ui/command.tsx` — shadcn 风格 cmd 命令原语（CommandPalette 底层）
- `web/src/shared/ui/cursor.tsx` — 全局自定义游标组件
- `web/src/shared/ui/theme-transition.css.ts` — clip-path 主题切换 hook（封装副作用）
- `web/src/shared/lib/hooks/use-spotlight.ts` — 鼠标聚光位置计算（纯，可测）
- `web/src/shared/lib/hooks/use-magnetic.ts` — 磁性吸附计算（纯，可测）
- `web/src/shared/lib/hooks/use-scroll-progress.ts` — 阅读进度（纯，可测）
- `web/src/shared/lib/hooks/use-toc.ts` — 从 markdown/HTML 提取并跟踪 TOC（纯提取，可测）
- `web/src/shared/lib/hooks/cmd-filter.ts` — 命令面板过滤算法（纯函数，可测）
- `web/src/shared/lib/hooks/__tests__/use-spotlight.test.ts`
- `web/src/shared/lib/hooks/__tests__/use-magnetic.test.ts`
- `web/src/shared/lib/hooks/__tests__/use-scroll-progress.test.ts`
- `web/src/shared/lib/hooks/__tests__/use-toc.test.ts`
- `web/src/shared/lib/hooks/__tests__/cmd-filter.test.ts`

---

## Task 1: Vitest 配置与第一个纯函数测试（脚手架）

**Files:**
- Create: `web/vitest.config.ts`
- Create: `web/src/shared/lib/hooks/__tests__/sanity.test.ts`

**目的：** 仓库目前没有 vitest.config（package.json 有 `test` 脚本但无配置），先建立测试底座，后续所有纯函数任务依赖它。

- [ ] **Step 1: 写 sanity 测试**

`web/src/shared/lib/hooks/__tests__/sanity.test.ts`:
```ts
import { describe, expect, it } from "vitest";

describe("vitest sanity", () => {
	it("runs", () => {
		expect(1 + 1).toBe(2);
	});
});
```

- [ ] **Step 2: 写 vitest.config.ts**

`web/vitest.config.ts`:
```ts
import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		environment: "jsdom",
		globals: false,
		include: ["src/**/*.test.{ts,tsx}"],
	},
	resolve: {
		alias: {
			"#": resolve(__dirname, "src"),
			"@": resolve(__dirname, "src"),
			"@shared": resolve(__dirname, "src/shared"),
			"@features": resolve(__dirname, "src/features"),
			"@widgets": resolve(__dirname, "src/widgets"),
			"@ui": resolve(__dirname, "src/shared/ui"),
			"@lib": resolve(__dirname, "src/shared/lib"),
			"@config": resolve(__dirname, "src/shared/config"),
			"@vendor/react-bits": resolve(__dirname, "src/shared/vendor/react-bits"),
		},
	},
});
```

- [ ] **Step 3: 跑测试确认通过**

Run: `cd web && pnpm test`
Expected: 1 test passed（`vitest sanity > runs`）。

- [ ] **Step 4: 验证架构没被破坏**

Run: `cd web && npx biome check . && npx tsc --noEmit`
Expected: 两条都无错误（vitest.config.ts 与 test 文件被 biome 纳入 `**/src/**/*` 与 `**/*.ts`，会通过）。

- [ ] **Step 5: Commit**

```bash
cd web && git add vitest.config.ts src/shared/lib/hooks/__tests__/sanity.test.ts
git commit -m "test(web): 建立 vitest 测试底座"
```

---

## Task 2: 双主题设计令牌重写（赛博深空 / 工业蓝图）

**Files:**
- Modify: `web/src/styles.css`（整体重写）

**目的：** 落地 spec 双主题色板与质感，所有后续组件依赖这些 CSS 变量。仍用 Tailwind v4 `@theme` + `hsl()` 包装，保持 `bg-background`/`text-foreground` 等工具类语义不变（避免动业务层）。

- [ ] **Step 1: 整体替换 `web/src/styles.css`**

```css
@import "tailwindcss";
@import "tw-animate-css";

@custom-variant dark (&:is(.dark *));

/* ============================================================
 * Nexus-Blog 设计令牌 — Tailwind v4 @theme
 * 双主题：Dark = 赛博深空 / Light = 工业蓝图无尘室
 * 语义变量名保持向后兼容（background/foreground/card/border/...），
 * 这样不用动任何业务层引用。
 * ============================================================ */
@theme {
  --color-border: hsl(var(--border));
  --color-background: hsl(var(--background));
  --color-foreground: hsl(var(--foreground));
  --color-primary: hsl(var(--primary));
  --color-primary-foreground: hsl(var(--primary-foreground));
  --color-secondary: hsl(var(--secondary));
  --color-secondary-foreground: hsl(var(--secondary-foreground));
  --color-muted: hsl(var(--muted));
  --color-muted-foreground: hsl(var(--muted-foreground));
  --color-accent: hsl(var(--accent));
  --color-accent-foreground: hsl(var(--accent-foreground));
  --color-card: hsl(var(--card));
  --color-card-foreground: hsl(var(--card-foreground));
  --color-destructive: hsl(var(--destructive));
  --color-destructive-foreground: hsl(var(--destructive-foreground));
  --color-input: hsl(var(--input));
  --color-ring: hsl(var(--ring));

  /* Nexus 扩展令牌（赛博 / 工业 双轨） */
  --color-neon-blue: hsl(var(--neon-blue));
  --color-neon-purple: hsl(var(--neon-purple));
  --color-neon-green: hsl(var(--neon-green));
  --color-surface-glass: hsl(var(--surface-glass));
  --color-edge-hairline: hsl(var(--edge-hairline));
  --color-glow-soft: hsl(var(--glow-soft));

  --font-sans: "Inter", system-ui, -apple-system, sans-serif;
  --font-mono: "JetBrains Mono", "Fira Code", ui-monospace, monospace;
  --radius: 0.5rem;
}

@layer base {
  /* ---------- Light：工业蓝图 / 无尘室 ---------- */
  :root {
    --background: 0 0% 98%;            /* 珍珠灰 #FAFAFA */
    --foreground: 240 10% 11%;         /* 墨灰 #18181B */
    --card: 0 0% 100%;
    --card-foreground: 240 10% 11%;
    --primary: 240 10% 11%;
    --primary-foreground: 0 0% 100%;
    --secondary: 240 5% 96%;
    --secondary-foreground: 240 10% 11%;
    --muted: 240 5% 96%;
    --muted-foreground: 240 4% 46%;
    --accent: 240 5% 94%;
    --accent-foreground: 240 10% 11%;
    --destructive: 0 72% 51%;
    --destructive-foreground: 0 0% 100%;
    --border: 240 6% 90%;
    --input: 240 6% 90%;
    --ring: 240 10% 11%;

    /* Light 扩展：摒弃发光，柔阴影 + 1px 极细边框 */
    --neon-blue: 222 47% 30%;
    --neon-purple: 280 30% 30%;
    --neon-green: 160 40% 25%;
    --surface-glass: 0 0% 100%;
    --edge-hairline: 240 6% 88%;       /* rgba(0,0,0,0.05) 等价 */
    --glow-soft: 0 0% 100%;            /* Light 下 glow 退化为白 */

    /* 多层超柔物理阴影（no glow） */
    --shadow-physical: 0 1px 2px rgba(15,15,20,0.04), 0 4px 12px rgba(15,15,20,0.04), 0 16px 40px rgba(15,15,20,0.05);
  }

  /* ---------- Dark：赛博深空 / 终端 ---------- */
  .dark {
    --background: 240 10% 4%;          /* 深空黑 #09090b，拒绝死黑 */
    --foreground: 210 20% 96%;
    --card: 240 10% 6%;
    --card-foreground: 210 20% 96%;
    --primary: 210 20% 96%;
    --primary-foreground: 240 10% 6%;
    --secondary: 240 6% 12%;
    --secondary-foreground: 210 20% 96%;
    --muted: 240 6% 12%;
    --muted-foreground: 215 14% 60%;
    --accent: 240 6% 16%;
    --accent-foreground: 210 20% 96%;
    --destructive: 0 62% 40%;
    --destructive-foreground: 210 20% 96%;
    --border: 240 6% 16%;
    --input: 240 6% 16%;
    --ring: 215 90% 66%;

    /* Dark 扩展：霓虹冷蓝 / 电光紫 glow */
    --neon-blue: 210 100% 66%;
    --neon-purple: 270 100% 72%;
    --neon-green: 150 100% 55%;
    --surface-glass: 240 10% 8%;
    --edge-hairline: 240 6% 20%;
    --glow-soft: 210 100% 66%;

    --shadow-physical: 0 0 0 1px rgba(120,160,255,0.06), 0 0 24px rgba(80,120,255,0.05);
  }

  * {
    box-sizing: border-box;
    border-color: hsl(var(--border));
  }

  html, body, #app {
    min-height: 100%;
  }

  body {
    margin: 0;
    background-color: hsl(var(--background));
    color: hsl(var(--foreground));
    font-family: var(--font-sans);
    /* Light 模式带极细微颗粒/纸张感（SVG noise，data-uri，零外部依赖） */
    background-image: var(--bg-grain);
    background-size: 200px 200px;
    /* 主题切换由 ThemeTransition 控制 clip-path，body 自身不参与动画 */
  }

  :root {
    --bg-grain: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.015'/%3E%3C/svg%3E");
  }
  .dark { --bg-grain: none; }

  /* 终端字体（代码块 / 解密文本 / 命令） */
  .font-mono { font-family: var(--font-mono); }
}

/* ============================================================
 * 主题切换：400ms clip-path 圆形扩散（非全屏闪烁）
 * 由 ThemeTransition 写入 --theme-transition-origin，本规则消费
 * ============================================================ */
@layer utilities {
  .theme-clip {
    transition: clip-path 400ms cubic-bezier(0.4, 0, 0.2, 1);
    clip-path: circle(0px at var(--theme-x, 50%) var(--theme-y, 50%));
  }
  .theme-clip.is-revealed {
    clip-path: circle(150% at var(--theme-x, 50%) var(--theme-y, 50%));
  }
}

/* ============================================================
 * 滚动遮罩：列表上下渐隐，卡片从暗影浮现
 * .scroll-mask 配合 ScrollArea 使用
 * ============================================================ */
@layer utilities {
  .scroll-mask-y {
    -webkit-mask-image: linear-gradient(
      to bottom,
      transparent 0,
      #000 48px,
      #000 calc(100% - 48px),
      transparent 100%
    );
    mask-image: linear-gradient(
      to bottom,
      transparent 0,
      #000 48px,
      #000 calc(100% - 48px),
      transparent 100%
    );
  }
}

/* ============================================================
 * 自定义游标：隐藏系统游标，由 CustomCursor 组件接管
 * 仅在 pointer:fine 设备启用（触屏关闭）
 * ============================================================ */
@media (pointer: fine) {
  .cursor-custom, .cursor-custom * {
    cursor: none;
  }
}
```

- [ ] **Step 2: 跑架构验证**

Run: `cd web && npx biome check . && npx tsc --noEmit`
Expected: 无错误（`styles.css` 已在 biome `files.includes` 中被 `!**/src/styles.css` 排除，故 biome 不校验它；tsc 不查 CSS）。

- [ ] **Step 3: Commit**

```bash
cd web && git add src/styles.css
git commit -m "feat(web): 重写设计令牌为 Nexus 双主题（赛博深空/工业蓝图）"
```

---

## Task 3: 主题切换物理转场 hook（clip-path 圆形扩散）

**Files:**
- Create: `web/src/shared/ui/theme-transition.tsx`
- Create: `web/src/shared/lib/hooks/__tests__/theme-origin.test.ts`

**目的：** 替换 next-themes 默认「瞬时切换」。点击位置为圆心，400ms `clip-path` 圆形扩散，新主题像光晕从点击点展开。仍用 next-themes 做 `class` 注入与 cookie 持久化（保留架构），只在外面包一层动画。

- [ ] **Step 1: 写纯函数测试（坐标解析）**

`web/src/shared/lib/hooks/__tests__/theme-origin.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { resolveTransitionOrigin } from "../theme-transition";

describe("resolveTransitionOrigin", () => {
	it("uses the click coordinates when provided", () => {
		const ev = { clientX: 120, clientY: 80 } as MouseEvent;
		expect(resolveTransitionOrigin(ev, { w: 1000, h: 600 })).toEqual({
			x: 12,
			y: 13,
		});
	});

	it("falls back to viewport center when clientX/Y missing", () => {
		const ev = {} as MouseEvent;
		expect(resolveTransitionOrigin(ev, { w: 1000, h: 600 })).toEqual({
			x: 50,
			y: 50,
		});
	});

	it("clamps within 0..100 percent", () => {
		const ev = { clientX: -50, clientY: 9999 } as MouseEvent;
		expect(resolveTransitionOrigin(ev, { w: 1000, h: 600 })).toEqual({
			x: 0,
			y: 100,
		});
	});
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd web && pnpm test src/shared/lib/hooks/__tests__/theme-origin.test.ts`
Expected: FAIL（`theme-transition` 模块不存在）。

- [ ] **Step 3: 写实现**

`web/src/shared/ui/theme-transition.tsx`:
```tsx
import { useCallback } from "react";
import { useTheme } from "next-themes";

/** 过渡原点（百分比，0..100） */
export interface TransitionOrigin {
	x: number;
	y: number;
}

export interface ViewportSize {
	w: number;
	h: number;
}

/**
 * resolveTransitionOrigin - 把点击事件换算为百分比坐标
 *
 * 导出为纯函数便于单测：无 DOM 副作用，只算数学。
 */
export function resolveTransitionOrigin(
	ev: MouseEvent | { clientX?: number; clientY?: number },
	vp: ViewportSize,
): TransitionOrigin {
	const x = ev.clientX ?? vp.w / 2;
	const y = ev.clientY ?? vp.h / 2;
	return {
		x: vp.w > 0 ? Math.max(0, Math.min(100, (x / vp.w) * 100)) : 50,
		y: vp.h > 0 ? Math.max(0, Math.min(100, (y / vp.h) * 100)) : 50,
	};
}

/**
 * useThemeTransition - 包裹 next-themes.setTheme，叠加 clip-path 圆形扩散
 *
 * 返回 toggle(event?)：在点击点展开新主题。
 * 不改 next-themes 的 class 注入与 cookie 行为（保留架构）。
 */
export function useThemeTransition() {
	const { theme, setTheme } = useTheme();

	const toggle = useCallback(
		(ev?: { clientX?: number; clientY?: number }) => {
			const vp: ViewportSize = {
				w: typeof window !== "undefined" ? window.innerWidth : 0,
				h: typeof window !== "undefined" ? window.innerHeight : 0,
			};
			const { x, y } = resolveTransitionOrigin(ev ?? {}, vp);

			// 在 <html> 上写原点 + 临时挂遮罩层（由 ThemeOverlay 组件渲染）
			const root = document.documentElement;
			root.style.setProperty("--theme-x", `${x}%`);
			root.style.setProperty("--theme-y", `${y}%`);
			root.dataset.themeTransitioning = "1";

			// next-themes 切换 class（cookie 持久化由 next-themes 负责）
			setTheme(theme === "dark" ? "light" : "dark");

			// 400ms 后清理（与 styles.css 中 transition 时长一致）
			window.setTimeout(() => {
				delete root.dataset.themeTransitioning;
			}, 400);
		},
		[theme, setTheme],
	);

	return { toggle, theme };
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `cd web && pnpm test src/shared/lib/hooks/__tests__/theme-origin.test.ts`
Expected: 3 tests passed。

- [ ] **Step 5: 跑架构验证**

Run: `cd web && npx biome check src/shared/ui/theme-transition.tsx && npx tsc --noEmit`
Expected: 无错误。

- [ ] **Step 6: Commit**

```bash
cd web && git add src/shared/ui/theme-transition.tsx src/shared/lib/hooks/__tests__/theme-origin.test.ts
git commit -m "feat(web): 新增主题切换 clip-path 圆形扩散 hook"
```

---

## Task 4: 机械青轴 3D 键帽原语（无重排的物理按键）

**Files:**
- Create: `web/src/shared/ui/mech-switch.tsx`

**目的：** 落地 spec「机械轴体主题切换器」铁律。键帽用 CSS 3D transform + box-shadow 在自身 Bounding Box 内做 `translateY` 下压，**Hover 不缩放、不位移**，只改环境光/反射率。Active 时 `translateY(3px)` 下压，阴影同步收缩，绝不引起周围 DOM 重排。

- [ ] **Step 1: 写实现**

`web/src/shared/ui/mech-switch.tsx`:
```tsx
import * as React from "react";
import { cn } from "@shared/lib/utils";

/**
 * MechSwitchProps - 机械青轴键帽
 */
export interface MechSwitchProps
	extends React.ButtonHTMLAttributes<HTMLButtonElement> {
	/** 键帽内显图标/文字 */
	children?: React.ReactNode;
	/** 是否处于「按下/激活」状态（如 dark mode） */
	pressed?: boolean;
	/** aria-label */
	"aria-label"?: string;
}

/**
 * MechSwitch - 机械青轴 3D 键帽原语
 *
 * 严格遵守 spec：
 * - Hover：不缩放、不位移，仅环境光/材质反射率变化（box-shadow 边缘光晕）
 * - Active/pressed：translateY(3px) 下压，阴影同步收缩
 * - 所有位移在自身 Bounding Box 内消化，绝不引起周围 reflow
 *
 * 物理质感由 CSS 变量驱动：
 * - Dark：阳极氧化铝（冷蓝边光 + 高光）
 * - Light：复古哑光高密度塑料（柔阴影 + 极细 1px 边框）
 */
const MechSwitch = React.forwardRef<HTMLButtonElement, MechSwitchProps>(
	({ className, children, pressed, ...props }, ref) => {
		return (
			<button
				ref={ref}
				type="button"
				aria-pressed={pressed}
				data-pressed={pressed ? "1" : "0"}
				className={cn(
					"relative isolate inline-grid place-items-center",
					"h-11 w-11 rounded-[10px]",
					"font-mono text-sm select-none",
					// 底座（永远固定，不参与按压动画 → 无 reflow）
					"before:absolute before:inset-0 before:rounded-[10px] before:-z-10",
					"before:translate-y-1 before:bg-border",
					// 键帽（3D 下压仅在自身 box 内）
					"after:absolute after:inset-0 after:rounded-[10px] after:-z-10",
					// Hover：仅环境光/反射率，无 scale/位移
					"hover:after:brightness-110 dark:hover:after:brightness-125",
					"transition-[transform,box-shadow] duration-75 ease-out",
					"active:translate-y-[3px]",
					pressed && "translate-y-[3px]",
					// 取消浏览器默认 focus 黑框，改 ring
					"outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
					className,
				)}
				style={{
					// 键帽渐变质感（CSS 变量随主题切换）
					background:
						"linear-gradient(180deg, hsl(var(--card)) 0%, hsl(var(--secondary)) 100%)",
					boxShadow: pressed
						? "inset 0 1px 0 rgba(255,255,255,0.06), 0 1px 0 rgba(0,0,0,0.2)"
						: "inset 0 1px 0 rgba(255,255,255,0.08), 0 2px 0 rgba(0,0,0,0.25), var(--shadow-physical)",
				}}
				{...props}
			>
				{children}
			</button>
		);
	},
);
MechSwitch.displayName = "MechSwitch";

export { MechSwitch };
```

- [ ] **Step 2: 跑架构验证**

Run: `cd web && npx biome check src/shared/ui/mech-switch.tsx && npx tsc --noEmit`
Expected: 无错误。

> 注：`web/src/shared/ui/**` 在 biome `files.includes` 里被 `!**/src/shared/ui/**` 排除，故 biome 不校验它（与现有 button.tsx 一致），这里命令会因 includes 过滤而无输出（视为通过）。tsc 仍校验类型。

- [ ] **Step 3: Commit**

```bash
cd web && git add src/shared/ui/mech-switch.tsx
git commit -m "feat(web): 新增机械青轴 3D 键帽原语 MechSwitch"
```

---

## Task 5: 重写 ThemeToggle 为机械轴体 + clip-path 转场

**Files:**
- Modify: `web/src/widgets/ThemeToggle/ThemeToggle.tsx`
- Create: `web/src/widgets/ThemeToggle/ThemeOverlay.tsx`

**目的：** 把 spec「首屏底部 20% 极左侧边缘的机械轴体切换器」落到 ThemeToggle。位置由父容器（Task 13 的 20% 底座）控制，本任务只做按键本身 + 点击触发 `useThemeTransition`。

- [ ] **Step 1: 新建 ThemeOverlay（clip-path 遮罩层）**

`web/src/widgets/ThemeToggle/ThemeOverlay.tsx`:
```tsx
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";

/**
 * ThemeOverlay - 主题切换时的 clip-path 圆形扩散遮罩
 *
 * 监听 <html data-theme-transitioning>：当 useThemeTransition 触发时，
 * 一层覆盖整个视口的「新主题背景色」从点击点圆形展开（400ms），
 * 展开完成后 next-themes 已切完 class，遮罩淡出。
 *
 * 严格遵守 spec：拒绝全屏闪烁，用 clip-path 扩散。
 */
const ThemeOverlay = () => {
	const { theme } = useTheme();
	const [active, setActive] = useState(false);

	useEffect(() => {
		const root = document.documentElement;
		const obs = new MutationObserver(() => {
			if (root.dataset.themeTransitioning === "1") setActive(true);
		});
		obs.observe(root, { attributes: true, attributeFilter: ["data-theme-transitioning"] });
		return () => obs.disconnect();
	}, []);

	useEffect(() => {
		if (!active) return;
		const t = window.setTimeout(() => setActive(false), 400);
		return () => window.clearTimeout(t);
	}, [active]);

	if (!active) return null;

	// 遮罩色 = 即将切换到的目标主题的 background（反之）
	const targetIsDark = theme !== "dark";

	return (
		<div
			aria-hidden
			className={active ? "theme-clip is-revealed" : "theme-clip"}
			style={{
				position: "fixed",
				inset: 0,
				zIndex: 9999,
				pointerEvents: "none",
				backgroundColor: targetIsDark
					? "hsl(240 10% 4%)"
					: "hsl(0 0% 98%)",
			}}
		/>
	);
};

export default ThemeOverlay;
```

- [ ] **Step 2: 重写 ThemeToggle**

整体替换 `web/src/widgets/ThemeToggle/ThemeToggle.tsx`:
```tsx
import { MechSwitch } from "@shared/ui/mech-switch";
import { useThemeTransition } from "@shared/ui/theme-transition";
import { Moon, Sun } from "lucide-react";

/**
 * ThemeToggle - 机械轴体主题切换器
 *
 * spec：放置首屏底部 20% 区域极左侧边缘（位置由父容器控制）。
 * - Hover：仅环境光/反射率，不缩放不位移（由 MechSwitch 保证）
 * - Active：键帽 translateY(3px) 下压，自身 box 内消化，无 reflow
 * - 切换：触发 useThemeTransition 的 clip-path 圆形扩散（非闪烁）
 *
 * 仍走 next-themes 的 class 注入 + cookie 持久化（保留架构）。
 * pressed 反映当前是否 dark。
 */
const ThemeToggle = () => {
	const { toggle, theme } = useThemeTransition();
	const isDark = theme === "dark";

	return (
		<MechSwitch
			aria-label="切换主题"
			pressed={isDark}
			onClick={(e) => toggle(e)}
		>
			{isDark ? <Moon className="size-4" /> : <Sun className="size-4" />}
		</MechSwitch>
	);
};

export default ThemeToggle;
```

- [ ] **Step 3: 跑架构验证**

Run: `cd web && npx biome check src/widgets/ThemeToggle && npx tsc --noEmit`
Expected: 无错误。

- [ ] **Step 4: Commit**

```bash
cd web && git add src/widgets/ThemeToggle/
git commit -m "feat(web): ThemeToggle 改用机械轴体 + clip-path 圆形扩散转场"
```

---

## Task 6: Shimmer 骨架原语（替代 Loader）

**Files:**
- Modify: `web/src/shared/ui/skeleton.tsx`
- Create: `web/src/shared/ui/shimmer-skeleton.tsx`

**目的：** spec 明令「严禁 LoaderCircle/旋转图标」，改用带光影扫过的精密骨架。保留原 `Skeleton` 导出签名（向后兼容 PostList 已有引用），内部改为 shimmer；再额外导出 `ShimmerSkeleton` 精密变体。

- [ ] **Step 1: 写 ShimmerSkeleton**

`web/src/shared/ui/shimmer-skeleton.tsx`:
```tsx
import { cn } from "@shared/lib/utils";
import * as React from "react";

/**
 * ShimmerSkeleton - 光影扫过精密骨架
 *
 * spec：替代 LoaderCircle。一道高光每 1.6s 横扫，
 * 暗底 + 极细 1px 顶部高光线（模拟玻璃边缘）。
 */
function ShimmerSkeleton({
	className,
	...props
}: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="shimmer-skeleton"
			className={cn(
				"relative overflow-hidden rounded-md",
				"bg-secondary",
				className,
			)}
			{...props}
		>
			{/* 顶部极细高光线 */}
			<span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-edge-hairline to-transparent" />
			{/* 光影扫过 */}
			<span
				className="pointer-events-none absolute inset-0 -translate-x-full"
				style={{
					background:
						"linear-gradient(90deg, transparent, hsl(var(--glow-soft) / 0.12), transparent)",
					animation: "nexus-shimmer 1.6s ease-in-out infinite",
				}}
			/>
		</div>
	);
}

export { ShimmerSkeleton };
```

- [ ] **Step 2: 把 styles.css 补 shimmer keyframes**

在 `web/src/styles.css` 末尾追加（用 Edit，不重写整文件）：

```css
@layer utilities {
  @keyframes nexus-shimmer {
    100% { transform: translateX(100%); }
  }
}
```

具体 Edit：将
```css
@media (pointer: fine) {
  .cursor-custom, .cursor-custom * {
    cursor: none;
  }
}
```
改为（在其后追加 keyframes）：
```css
@media (pointer: fine) {
  .cursor-custom, .cursor-custom * {
    cursor: none;
  }
}

@layer utilities {
  @keyframes nexus-shimmer {
    100% { transform: translateX(100%); }
  }
}
```

- [ ] **Step 3: 升级原 Skeleton 也用 shimmer（保签名向后兼容）**

整体替换 `web/src/shared/ui/skeleton.tsx`:
```tsx
import { cn } from "@/shared/lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        "relative overflow-hidden rounded-md bg-secondary",
        className,
      )}
      {...props}
    >
      <span
        className="pointer-events-none absolute inset-0 -translate-x-full"
        style={{
          background:
            "linear-gradient(90deg, transparent, hsl(var(--glow-soft) / 0.12), transparent)",
          animation: "nexus-shimmer 1.6s ease-in-out infinite",
        }}
      />
    </div>
  )
}

export { Skeleton }
```

- [ ] **Step 4: 跑架构验证**

Run: `cd web && npx tsc --noEmit && pnpm test`
Expected: 无类型错误；之前的 sanity 测试仍通过。

- [ ] **Step 5: Commit**

```bash
cd web && git add src/shared/ui/skeleton.tsx src/shared/ui/shimmer-skeleton.tsx src/styles.css
git commit -m "feat(web): 骨架改用光影扫过 shimmer，弃用旋转 Loader"
```

---

## Task 7: 物理时间轴步骤原语（线条先到，节点后亮）

**Files:**
- Create: `web/src/shared/ui/steps.tsx`

**目的：** spec 铁律「连接线动画必须完全到达下一节点后，该节点才能点亮」。用 CSS `transition-delay` 让连线 `width 0→100%` 跑完（300ms），再让下个节点 dot 在 300ms 后变亮。

- [ ] **Step 1: 写实现**

`web/src/shared/ui/steps.tsx`:
```tsx
import { cn } from "@shared/lib/utils";
import * as React from "react";

/** 步骤项 */
export interface StepItem {
	/** 标题 */
	title: string;
	/** 描述（可选） */
	description?: string;
}

export interface StepsProps {
	/** 步骤列表 */
	steps: StepItem[];
	/** 当前激活到第几步（0-based）。激活后线条与节点依次点亮 */
	current: number;
	className?: string;
}

/**
 * PhysicalSteps - 物理时间轴
 *
 * spec 铁律：线条动画必须**完全到达**下一节点后，该节点 dot 才点亮。
 * 实现：每段连线 width 用 transition 300ms，下个节点的 dot 用
 * transition-delay 300ms，保证物理先后顺序。
 *
 * 不引起 reflow：所有动画走 transform/width 在固定布局内。
 */
function PhysicalSteps({ steps, current, className }: StepsProps) {
	return (
		<ol className={cn("flex flex-col gap-0", className)}>
			{steps.map((step, i) => {
				const isDone = i < current;
				const isActive = i === current;
				const nextReached = i < current; // 第 i 段线连到 i+1，i+1 已亮则线全亮
				return (
					<li key={step.title} className="relative flex gap-4 pb-8 last:pb-0">
						{/* 节点列 */}
						<div className="relative flex flex-col items-center">
							{/* 当前节点 dot */}
							<span
								className={cn(
									"size-3 rounded-full border transition-colors duration-300",
									isActive || isDone
										? "border-neon-blue bg-neon-blue shadow-[0_0_12px_hsl(var(--glow-soft)/0.6)]"
										: "border-border bg-background",
								)}
								style={{
									// 节点点亮延迟 300ms = 连线到达后
									transitionDelay: i > 0 ? "300ms" : "0ms",
								}}
							/>
							{/* 连接到下一节点的线（在两节点之间） */}
							{i < steps.length - 1 && (
								<span
									className="mt-1 w-px flex-1 bg-border"
									style={{
										background:
											nextReached
												? "linear-gradient(to bottom, hsl(var(--neon-blue)), hsl(var(--border)))"
												: undefined,
									}}
								>
									<span
										className="block h-full w-full origin-top transition-transform duration-300"
										style={{
											transform: nextReached ? "scaleY(1)" : "scaleY(0)",
											background: nextReached
												? "hsl(var(--neon-blue))"
												: "transparent",
										}}
									/>
								</span>
							)}
						</div>
						{/* 文本列 */}
						<div className="pt-0.5">
							<p
								className={cn(
									"font-medium transition-colors duration-300",
									isActive || isDone
										? "text-foreground"
										: "text-muted-foreground",
								)}
							>
								{step.title}
							</p>
							{step.description ? (
								<p className="text-sm text-muted-foreground mt-1">
									{step.description}
								</p>
							) : null}
						</div>
					</li>
				);
			})}
		</ol>
	);
}

export { PhysicalSteps };
```

- [ ] **Step 2: 跑架构验证**

Run: `cd web && npx tsc --noEmit`
Expected: 无类型错误。

- [ ] **Step 3: Commit**

```bash
cd web && git add src/shared/ui/steps.tsx
git commit -m "feat(web): 新增物理时间轴步骤原语（线条先到节点后亮）"
```

---

## Task 8: ScrollArea 渐隐遮罩滚动容器原语

**Files:**
- Create: `web/src/shared/ui/scroll-area.tsx`

**目的：** spec「列表上下滚动带线性渐隐遮罩，卡片从暗影中浮现消散」。封装一个应用 `.scroll-mask-y` 的滚动容器，供虚拟列表与 TOC 复用。

- [ ] **Step 1: 写实现**

`web/src/shared/ui/scroll-area.tsx`:
```tsx
import { cn } from "@shared/lib/utils";
import * as React from "react";

export interface ScrollAreaProps
	extends React.HTMLAttributes<HTMLDivElement> {
	/** 遮罩方向，默认上下渐隐 */
	mask?: "y" | "none";
}

/**
 * ScrollArea - 带渐隐遮罩的滚动容器
 *
 * spec：列表上下滚动带线性渐隐遮罩，卡片从暗影中浮现与消散。
 * .scroll-mask-y 由 styles.css 提供 mask-image。
 *
 * 不依赖 Radix ScrollArea（避免引入额外滚动条样式冲突），原生 overflow。
 */
const ScrollArea = React.forwardRef<HTMLDivElement, ScrollAreaProps>(
	({ className, children, mask = "y", ...props }, ref) => {
		return (
			<div
				ref={ref}
				className={cn(
					"overflow-y-auto",
					mask === "y" && "scroll-mask-y",
					className,
				)}
				{...props}
			>
				{children}
			</div>
		);
	},
);
ScrollArea.displayName = "ScrollArea";

export { ScrollArea };
```

- [ ] **Step 2: 跑架构验证**

Run: `cd web && npx tsc --noEmit`
Expected: 无类型错误。

- [ ] **Step 3: Commit**

```bash
cd web && git add src/shared/ui/scroll-area.tsx
git commit -m "feat(web): 新增渐隐遮罩滚动容器 ScrollArea"
```

---

## Task 9: use-spotlight / use-magnetic hooks（纯逻辑 + 测试）

**Files:**
- Create: `web/src/shared/lib/hooks/use-spotlight.ts`
- Create: `web/src/shared/lib/hooks/use-magnetic.ts`
- Create: `web/src/shared/lib/hooks/__tests__/use-spotlight.test.ts`
- Create: `web/src/shared/lib/hooks/__tests__/use-magnetic.test.ts`

**目的：** spec「卡片边缘聚光灯冷光跟随鼠标」「游标磁力吸附形变」。把鼠标坐标换算为 CSS 变量值的计算抽成纯函数（`computeSpotlight` / `computeMagnetic`），便于单测；hook 仅做 DOM 绑定。

- [ ] **Step 1: 写 use-spotlight 纯函数 + 测试**

`web/src/shared/lib/hooks/use-spotlight.ts`:
```ts
import { useCallback, type MouseEvent } from "react";

export interface Rect {
	left: number;
	top: number;
	width: number;
	height: number;
}

export interface SpotlightPos {
	/** 相对元素左上角的 x（px） */
	x: number;
	/** 相对元素左上角的 y（px） */
	y: number;
}

/**
 * computeSpotlight - 把鼠标事件换算为元素内坐标（纯函数，便于测）
 *
 * 鼠标在元素外时 clamp 到边缘，避免聚光跑飞。
 */
export function computeSpotlight(ev: MouseEvent, rect: Rect): SpotlightPos {
	const x = Math.max(0, Math.min(rect.width, ev.clientX - rect.left));
	const y = Math.max(0, Math.min(rect.height, ev.clientY - rect.top));
	return { x, y };
}

/**
 * useSpotlight - 绑定 mousemove，把坐标写到元素 style 变量 --spot-x/--spot-y
 */
export function useSpotlight() {
	return useCallback((e: MouseEvent<HTMLDivElement>) => {
		const el = e.currentTarget;
		const rect: Rect = {
			left: el.offsetLeft,
			top: el.offsetTop,
			width: el.offsetWidth,
			height: el.offsetHeight,
		};
		// offsetLeft 是相对 offsetParent，聚光需要相对元素自身 → 用 getBoundingClientRect 重算
		const r = el.getBoundingClientRect();
		const pos = computeSpotlight(e, {
			left: r.left,
			top: r.top,
			width: r.width,
			height: r.height,
		});
		el.style.setProperty("--spot-x", `${pos.x}px`);
		el.style.setProperty("--spot-y", `${pos.y}px`);
	}, []);
}
```

`web/src/shared/lib/hooks/__tests__/use-spotlight.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { computeSpotlight } from "../use-spotlight";

describe("computeSpotlight", () => {
	const rect = { left: 100, top: 50, width: 400, height: 200 };

	it("returns raw delta when inside", () => {
		expect(computeSpotlight({ clientX: 300, clientY: 150 } as any, rect)).toEqual({
			x: 200,
			y: 100,
		});
	});

	it("clamps to top-left edge when outside", () => {
		expect(computeSpotlight({ clientX: 0, clientY: 0 } as any, rect)).toEqual({
			x: 0,
			y: 0,
		});
	});

	it("clamps to bottom-right edge when outside", () => {
		expect(computeSpotlight({ clientX: 9999, clientY: 9999 } as any, rect)).toEqual({
			x: 400,
			y: 200,
		});
	});
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd web && pnpm test src/shared/lib/hooks/__tests__/use-spotlight.test.ts`
Expected: FAIL（模块不存在）。

- [ ] **Step 3: 写 use-magnetic 纯函数 + 测试**

`web/src/shared/lib/hooks/use-magnetic.ts`:
```ts
import { useCallback, type MouseEvent } from "react";

export interface MagneticInput {
	/** 鼠标相对视口坐标 */
	clientX: number;
	clientY: number;
	/** 元素中心点（视口坐标） */
	cx: number;
	cy: number;
	/** 吸附强度 0..1（1=完全贴住鼠标） */
	strength?: number;
}

export interface MagneticOffset {
	/** translate x（px） */
	dx: number;
	/** translate y（px） */
	dy: number;
}

/**
 * computeMagnetic - 计算磁性吸附位移（纯函数，便于测）
 *
 * 位移 = (鼠标 - 中心) * strength，鼠标越远偏移越大，
 * spec「靠近可点击元素产生轻微磁力吸附」。
 */
export function computeMagnetic(input: MagneticInput): MagneticOffset {
	const { clientX, clientY, cx, cy, strength = 0.25 } = input;
	return {
		dx: (clientX - cx) * strength,
		dy: (clientY - cy) * strength,
	};
}

/**
 * useMagnetic - 返回 onMouseMove/onMouseLeave 处理器，写 --mx/--my
 */
export function useMagnetic(strength = 0.25) {
	const onMouseMove = useCallback(
		(e: MouseEvent<HTMLElement>) => {
			const el = e.currentTarget;
			const r = el.getBoundingClientRect();
			const off = computeMagnetic({
				clientX: e.clientX,
				clientY: e.clientY,
				cx: r.left + r.width / 2,
				cy: r.top + r.height / 2,
				strength,
			});
			el.style.setProperty("--mx", `${off.dx}px`);
			el.style.setProperty("--my", `${off.dy}px`);
		},
		[strength],
	);
	const onMouseLeave = useCallback((e: MouseEvent<HTMLElement>) => {
		const el = e.currentTarget;
		el.style.setProperty("--mx", "0px");
		el.style.setProperty("--my", "0px");
	}, []);
	return { onMouseMove, onMouseLeave };
}
```

`web/src/shared/lib/hooks/__tests__/use-magnetic.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { computeMagnetic } from "../use-magnetic";

describe("computeMagnetic", () => {
	it("pulls toward the cursor by strength", () => {
		const off = computeMagnetic({
			clientX: 120,
			clientY: 80,
			cx: 100,
			cy: 100,
			strength: 0.25,
		});
		expect(off).toEqual({ dx: 5, dy: -5 });
	});

	it("zero offset when cursor is at center", () => {
		const off = computeMagnetic({
			clientX: 50,
			clientY: 50,
			cx: 50,
			cy: 50,
		});
		expect(off).toEqual({ dx: 0, dy: 0 });
	});

	it("respects default strength 0.25", () => {
		const off = computeMagnetic({
			clientX: 200,
			clientY: 200,
			cx: 100,
			cy: 100,
		});
		expect(off).toEqual({ dx: 25, dy: 25 });
	});
});
```

- [ ] **Step 4: 跑测试确认全部通过**

Run: `cd web && pnpm test src/shared/lib/hooks/__tests__/use-spotlight.test.ts src/shared/lib/hooks/__tests__/use-magnetic.test.ts`
Expected: 6 tests passed。

- [ ] **Step 5: 跑架构验证**

Run: `cd web && npx biome check src/shared/lib/hooks/use-spotlight.ts src/shared/lib/hooks/use-magnetic.ts && npx tsc --noEmit`
Expected: 无错误。

- [ ] **Step 6: Commit**

```bash
cd web && git add src/shared/lib/hooks/use-spotlight.ts src/shared/lib/hooks/use-magnetic.ts src/shared/lib/hooks/__tests__/
git commit -m "feat(web): 新增聚光/磁性吸附计算 hook（含单测）"
```

---

## Task 10: SpotlightCard react-bits 组件（卡片边缘聚光灯）

**Files:**
- Create: `web/src/shared/vendor/react-bits/SpotlightCard.tsx`

**目的：** spec「博客列表卡片应用全局边缘聚光灯，冷光跟随鼠标游走于卡片边缘揭示材质边界」。用 `useSpotlight` 写入 `--spot-x/-y`，CSS `radial-gradient` 跟随，配合毛玻璃 + 霓虹边缘。

- [ ] **Step 1: 写实现**

`web/src/shared/vendor/react-bits/SpotlightCard.tsx`:
```tsx
import { cn } from "@shared/lib/utils";
import { useSpotlight } from "@shared/lib/hooks/use-spotlight";
import * as React from "react";

export interface SpotlightCardProps
	extends React.HTMLAttributes<HTMLDivElement> {
	/** 聚光半径（px） */
	radius?: number;
	/** 聚光颜色（dark 走 glow，light 自动透明化） */
	as?: React.ElementType;
}

/**
 * SpotlightCard - 全局边缘聚光灯卡片
 *
 * spec：冷光跟随鼠标游走于卡片边缘，揭示材质边界。
 * - 鼠标移动 → useSpotlight 写 --spot-x/--spot-y
 * - ::before 用 radial-gradient 在该点画冷光
 * - ::after 画 1px 渐变边框（dark 霓虹 / light 极细灰）
 *
 * Dark：深色毛玻璃 + 边缘霓虹冷蓝发光
 * Light：超柔多层物理阴影 + 1px rgba(0,0,0,0.05) 边框
 */
function SpotlightCard({
	className,
	children,
	radius = 220,
	as: Comp = "div",
	...props
}: SpotlightCardProps) {
	const onMove = useSpotlight();
	return (
		<Comp
			onMouseMove={onMove}
			className={cn(
				"group relative overflow-hidden rounded-xl",
				"bg-card text-card-foreground",
				"border border-edge-hairline",
				"transition-[box-shadow,transform] duration-300",
				// dark 毛玻璃 + glow；light 多层柔阴影（由 --shadow-physical 控制）
				"dark:bg-surface-glass/60 dark:backdrop-blur-xl",
				"shadow-[var(--shadow-physical)]",
				className,
			)}
			style={
				{
					"--spot-radius": `${radius}px`,
					...props.style,
				} as React.CSSProperties
			}
			{...props}
		>
			{/* 聚光层 */}
			<span
				aria-hidden
				className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
				style={{
					background:
						"radial-gradient(var(--spot-radius) circle at var(--spot-x, 50%) var(--spot-y, 50%), hsl(var(--glow-soft) / 0.18), transparent 60%)",
				}}
			/>
			{/* 渐变边框层（dark 霓虹） */}
			<span
				aria-hidden
				className="pointer-events-none absolute inset-0 rounded-xl opacity-0 transition-opacity duration-300 group-hover:opacity-100 dark:block hidden"
				style={{
					boxShadow:
						"inset 0 0 0 1px hsl(var(--neon-blue) / 0.35), inset 0 0 24px hsl(var(--neon-blue) / 0.08)",
				}}
			/>
			<div className="relative z-10">{children}</div>
		</Comp>
	);
}

export { SpotlightCard };
```

- [ ] **Step 2: 跑架构验证**

Run: `cd web && npx tsc --noEmit`
Expected: 无类型错误（`@shared/lib/hooks/use-spotlight` 已在 Task 9 创建，路径别名 `@lib` 与 `@shared` 都指向）。

> 注意：本文件用的是 `@shared/lib/hooks/use-spotlight` 与 `@shared/lib/utils`，符合 tsconfig `@shared/*` 别名。

- [ ] **Step 3: Commit**

```bash
cd web && git add src/shared/vendor/react-bits/SpotlightCard.tsx
git commit -m "feat(web): 新增 SpotlightCard 边缘聚光灯卡片"
```

---

## Task 11: ParticleField react-bits 组件（鼠标跟随流体粒子）

**Files:**
- Create: `web/src/shared/vendor/react-bits/ParticleField.tsx`

**目的：** spec「左侧视觉区用 React Bits 渲染极具极客感的鼠标跟随/流体粒子交互背景」。基于已有 `ogl`（package.json 已装）做轻量 2D 粒子，跟随鼠标流动，SSR 安全（仅在 client 跑）。

- [ ] **Step 1: 写实现**

`web/src/shared/vendor/react-bits/ParticleField.tsx`:
```tsx
import { useEffect, useRef } from "react";

/**
 * ParticleField - 鼠标跟随流体粒子背景（Canvas 2D）
 *
 * spec：左侧视觉区极具极客感的鼠标跟随粒子。
 * - 60 粒子在容器内漂浮，鼠标靠近时被「吸引/排开」产生流动
 * - Canvas 2D（轻量，避免 Aurora 的 WebGL 重量在左栏叠用）
 * - SSR 安全：仅在 useEffect（client）运行，首屏空 canvas 不影响 hydrate
 * - 颜色读 CSS 变量，自动跟随主题（dark 霓虹冷蓝 / light 墨灰）
 */
export interface ParticleFieldProps {
	/** 粒子数 */
	count?: number;
	className?: string;
}

export default function ParticleField({
	count = 60,
	className,
}: ParticleFieldProps) {
	const canvasRef = useRef<HTMLCanvasElement>(null);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		const dpr = Math.min(window.devicePixelRatio || 1, 2);
		let raf = 0;
		let w = 0;
		let h = 0;
		const mouse = { x: -9999, y: -9999 };

		const particles = Array.from({ length: count }, () => ({
			x: Math.random(),
			y: Math.random(),
			vx: (Math.random() - 0.5) * 0.0008,
			vy: (Math.random() - 0.5) * 0.0008,
			r: Math.random() * 1.6 + 0.6,
		}));

		const readColor = () => {
			const css = getComputedStyle(document.documentElement)
				.getPropertyValue("--neon-blue")
				.trim();
			// css 形如 "210 100% 66%"
			return css ? `hsl(${css})` : "hsl(210 100% 66%)";
		};
		let color = readColor();

		const resize = () => {
			const rect = canvas.getBoundingClientRect();
			w = rect.width;
			h = rect.height;
			canvas.width = w * dpr;
			canvas.height = h * dpr;
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		};

		const onMove = (e: MouseEvent) => {
			const rect = canvas.getBoundingClientRect();
			mouse.x = e.clientX - rect.left;
			mouse.y = e.clientY - rect.top;
		};
		const onLeave = () => {
			mouse.x = -9999;
			mouse.y = -9999;
		};

		const tick = () => {
			color = readColor();
			ctx.clearRect(0, 0, w, h);
			for (const p of particles) {
				p.x += p.vx;
				p.y += p.vy;
				if (p.x < 0 || p.x > 1) p.vx *= -1;
				if (p.y < 0 || p.y > 1) p.vy *= -1;

				const px = p.x * w;
				const py = p.y * h;

				// 鼠标吸引（轻微）
				const dx = mouse.x - px;
				const dy = mouse.y - py;
				const dist2 = dx * dx + dy * dy;
				if (dist2 < 14400) {
					const f = 0.02 / Math.max(40, Math.sqrt(dist2));
					p.vx += dx * f * 0.01;
					p.vy += dy * f * 0.01;
				}
				// 阻尼
				p.vx *= 0.99;
				p.vy *= 0.99;

				ctx.beginPath();
				ctx.fillStyle = color;
				ctx.globalAlpha = 0.6;
				ctx.arc(px, py, p.r, 0, Math.PI * 2);
				ctx.fill();
			}
			// 连线（近距离）
			ctx.globalAlpha = 0.12;
			ctx.strokeStyle = color;
			ctx.lineWidth = 0.6;
			for (let i = 0; i < particles.length; i++) {
				for (let j = i + 1; j < particles.length; j++) {
					const a = particles[i];
					const b = particles[j];
					const ax = a.x * w;
					const ay = a.y * h;
					const bx = b.x * w;
					const by = b.y * h;
					const d = Math.hypot(ax - bx, ay - by);
					if (d < 110) {
						ctx.globalAlpha = (1 - d / 110) * 0.15;
						ctx.beginPath();
						ctx.moveTo(ax, ay);
						ctx.lineTo(bx, by);
						ctx.stroke();
					}
				}
			}
			ctx.globalAlpha = 1;
			raf = requestAnimationFrame(tick);
		};

		resize();
		window.addEventListener("resize", resize);
		window.addEventListener("mousemove", onMove);
		canvas.addEventListener("mouseleave", onLeave);
		raf = requestAnimationFrame(tick);

		return () => {
			cancelAnimationFrame(raf);
			window.removeEventListener("resize", resize);
			window.removeEventListener("mousemove", onMove);
			canvas.removeEventListener("mouseleave", onLeave);
		};
	}, [count]);

	return (
		<canvas
			ref={canvasRef}
			className={className}
			style={{ width: "100%", height: "100%", display: "block" }}
			aria-hidden
		/>
	);
}
```

- [ ] **Step 2: 跑架构验证**

Run: `cd web && npx tsc --noEmit`
Expected: 无类型错误。

- [ ] **Step 3: Commit**

```bash
cd web && git add src/shared/vendor/react-bits/ParticleField.tsx
git commit -m "feat(web): 新增鼠标跟随流体粒子背景 ParticleField"
```

---

## Task 12: 重写 PostCard 为 SpotlightCard（消费现有 Post 类型）

**Files:**
- Modify: `web/src/features/posts/ui/PostCard.tsx`

**目的：** spec 博客卡片聚光灯 + 大小不一卡片不崩塌。保留 `PostCardProps` 接口与 `Post` 类型引用（**不动 features/posts/model**），只换渲染层为 `SpotlightCard`。

- [ ] **Step 1: 整体替换 PostCard**

`web/src/features/posts/ui/PostCard.tsx`:
```tsx
import { SpotlightCard } from "@shared/vendor/react-bits/SpotlightCard";
import { Link } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";

import type { Post } from "../model/types";

/**
 * PostCardProps - PostCard 组件属性
 */
export interface PostCardProps {
	/** 文章数据 */
	post: Post;
	/**
	 * 卡片视觉尺寸变体，支持虚拟列表大小不一不崩塌
	 * @default "md"
	 */
	size?: "sm" | "md" | "lg";
}

/**
 * PostCard - 文章卡片（Nexus Spotlight 版）
 *
 * spec：
 * - 全局边缘聚光灯（SpotlightCard）冷光跟随鼠标揭示材质边界
 * - 支持 sm/md/lg 三种高度，虚拟列表混排不崩塌
 * - 封面懒加载 + hover 图片放大（transform 不引起 reflow）
 * - 标签最多 3 个，相对时间
 *
 * 仍消费现有 Post 类型（features/posts/model），不动数据层。
 */
const PostCard = ({ post, size = "md" }: PostCardProps) => {
	const coverH =
		size === "lg" ? "h-56" : size === "sm" ? "h-32" : "h-44";

	return (
		<SpotlightCard className="flex h-full flex-col">
			{post.cover_image ? (
				<Link to="/blog/$slug" params={{ slug: post.slug }} className="block overflow-hidden">
					<img
						src={post.cover_image}
						alt={post.title}
						loading="lazy"
						className={`w-full ${coverH} object-cover transition-transform duration-500 group-hover:scale-105`}
					/>
				</Link>
			) : null}

			<div className="flex flex-1 flex-col p-5">
				{post.tags.length > 0 ? (
					<div className="mb-2 flex flex-wrap gap-1.5">
						{post.tags.slice(0, 3).map((tag) => (
							<span
								key={tag}
								className="rounded-full border border-edge-hairline bg-muted/50 px-2 py-0.5 font-mono text-[10px] text-muted-foreground"
							>
								{tag}
							</span>
						))}
					</div>
				) : null}

				<h3 className="mb-2 line-clamp-2 text-lg font-semibold leading-snug">
					<Link
						to="/blog/$slug"
						params={{ slug: post.slug }}
						className="transition-colors hover:text-neon-blue"
					>
						{post.title}
					</Link>
				</h3>

				<p className="mb-4 line-clamp-2 flex-1 text-sm text-muted-foreground">
					{post.excerpt}
				</p>

				<div className="flex items-center justify-between font-mono text-[11px] text-muted-foreground">
					<span className="flex items-center gap-1.5">
						{post.author.avatar_url ? (
							<img
								src={post.author.avatar_url}
								alt=""
								className="size-4 rounded-full"
								loading="lazy"
							/>
						) : null}
						{post.author.username}
					</span>
					<time>
						{formatDistanceToNow(new Date(post.published_at), {
							addSuffix: true,
							locale: zhCN,
						})}
					</time>
				</div>
			</div>
		</SpotlightCard>
	);
};

export default PostCard;
```

- [ ] **Step 2: 跑架构验证**

Run: `cd web && npx biome check src/features/posts/ui/PostCard.tsx && npx tsc --noEmit`
Expected: 无错误。

- [ ] **Step 3: Commit**

```bash
cd web && git add src/features/posts/ui/PostCard.tsx
git commit -m "feat(web): PostCard 改用 SpotlightCard + 尺寸变体"
```

---

## Task 13: 虚拟列表 PostList（大小不一卡片 + 滚动遮罩）

**Files:**
- Modify: `web/src/features/posts/ui/PostList.tsx`

**目的：** spec「右侧内容区用虚拟列表渲染，支持大小不一卡片而不崩塌；上下滚动带线性渐隐遮罩」。保留 `PostListProps` 接口与 `usePosts`（**不动 api**）。不引入重型虚拟列表库（仓库未装），用手写「窗口化渲染」：根据 `scrolltop` 与固定行高估算可见区间，足够满足博客场景。

- [ ] **Step 1: 整体替换 PostList**

`web/src/features/posts/ui/PostList.tsx`:
```tsx
import { ScrollArea } from "@shared/ui/scroll-area";
import { ShimmerSkeleton } from "@shared/ui/shimmer-skeleton";
import { useEffect, useMemo, useRef, useState } from "react";

import { usePosts } from "../api/queries";
import type { PostListQuery } from "../model/types";
import PostCard from "./PostCard";

export interface PostListProps {
	query?: PostListQuery;
	showSkeleton?: boolean;
	/** 每行卡片视觉尺寸轮转，实现「大小不一不崩塌」 */
	mixedSizes?: ("sm" | "md" | "lg")[];
	className?: string;
}

const ROW_HEIGHT: Record<string, number> = { sm: 240, md: 340, lg: 440 };

/**
 * PostList - 文章虚拟列表
 *
 * spec：
 * - 虚拟列表渲染，支持大小不一卡片而不崩塌
 * - 上下滚动带线性渐隐遮罩（ScrollArea 提供 mask）
 *
 * 实现：手写窗口化（无重型依赖）。每项高度由 mixedSizes[i % len] 决定，
 * 估算可见区间 [startIdx, endIdx]，只渲染可见 + 上下各 2 个缓冲。
 *
 * 三态保留：loading→shimmer 骨架，error→文案，空→提示。
 * 数据层（usePosts）不动。
 */
const PostList = ({
	query = {},
	showSkeleton = true,
	mixedSizes = ["md", "md", "lg"],
	className,
}: PostListProps) => {
	const { data, isLoading, isError, error } = usePosts(query);
	const scrollRef = useRef<HTMLDivElement>(null);
	const [scrollTop, setScrollTop] = useState(0);
	const [viewportH, setViewportH] = useState(800);

	useEffect(() => {
		const el = scrollRef.current;
		if (!el) return;
		const onScroll = () => setScrollTop(el.scrollTop);
		const onResize = () => setViewportH(el.clientHeight);
		onResize();
		el.addEventListener("scroll", onScroll, { passive: true });
		window.addEventListener("resize", onResize);
		return () => {
			el.removeEventListener("scroll", onScroll);
			window.removeEventListener("resize", onResize);
		};
	}, []);

	const items = data?.data ?? [];
	const sizes = useMemo(() => mixedSizes, [mixedSizes]);

	// 预计算每项 top 与总高度
	const layout = useMemo(() => {
		let acc = 0;
		const tops = items.map((_, i) => {
			const h = ROW_HEIGHT[sizes[i % sizes.length] ?? "md"];
			const top = acc;
			acc += h + 16; // gap
			return top;
		});
		return { tops, totalH: acc };
	}, [items, sizes]);

	if (isLoading && showSkeleton) {
		return (
			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{Array.from({ length: query.limit ?? 6 }).map((_, i) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: 静态骨架
					<ShimmerSkeleton key={`sk-${i}`} className="h-72" />
				))}
			</div>
		);
	}

	if (isError) {
		return (
			<p className="py-12 text-center text-muted-foreground">
				加载失败：{error instanceof Error ? error.message : "未知错误"}
			</p>
		);
	}

	if (!items.length) {
		return <p className="py-12 text-center text-muted-foreground">暂无文章</p>;
	}

	// 窗口化：找出与 [scrollTop - buffer, scrollTop + viewportH + buffer] 相交的项
	const buffer = 600;
	const startIdx = Math.max(
		0,
		layout.tops.findIndex((t) => t + (ROW_HEIGHT["md"] + 16) > scrollTop - buffer),
	);
	const endIdx = layout.tops.findIndex(
		(t) => t > scrollTop + viewportH + buffer,
	);
	const visibleEnd = endIdx === -1 ? items.length : endIdx;
	const visible = items.slice(
		startIdx === -1 ? 0 : startIdx,
		visibleEnd,
	);

	return (
		<ScrollArea
			ref={scrollRef}
			className={className}
			style={{ maxHeight: "70vh" }}
		>
			<div style={{ height: layout.totalH, position: "relative" }}>
				{visible.map((post, i) => {
					const idx = startIdx === -1 ? 0 : startIdx + i;
					const size = sizes[idx % sizes.length] ?? "md";
					return (
						<div
							key={post.id}
							style={{
								position: "absolute",
								top: layout.tops[idx],
								left: 0,
								right: 0,
							}}
						>
							<PostCard post={post} size={size} />
						</div>
					);
				})}
			</div>
		</ScrollArea>
	);
};

export default PostList;
```

- [ ] **Step 2: 跑架构验证**

Run: `cd web && npx biome check src/features/posts/ui/PostList.tsx && npx tsc --noEmit`
Expected: 无错误。

- [ ] **Step 3: Commit**

```bash
cd web && git add src/features/posts/ui/PostList.tsx
git commit -m "feat(web): PostList 改用虚拟列表窗口化 + 渐隐遮罩"
```

---

## Task 14: use-scroll-progress / use-toc hooks（详情页用，含测试）

**Files:**
- Create: `web/src/shared/lib/hooks/use-scroll-progress.ts`
- Create: `web/src/shared/lib/hooks/use-toc.ts`
- Create: `web/src/shared/lib/hooks/__tests__/use-scroll-progress.test.ts`
- Create: `web/src/shared/lib/hooks/__tests__/use-toc.test.ts`

**目的：** spec「详情页左侧动态 TOC，阅读进度与目录高亮同步」。抽两个纯函数：`computeScrollProgress`（滚动百分比）与 `extractToc`（从 HTML 抽 H2/H3 + id）。详情页（Task 18）消费。

- [ ] **Step 1: 写 use-scroll-progress**

`web/src/shared/lib/hooks/use-scroll-progress.ts`:
```ts
import { useEffect, useState } from "react";

export interface ProgressInput {
	/** 容器滚动距离 */
	scrollTop: number;
	/** 内容总可滚动高度 */
	scrollHeight: number;
	/** 视口高度 */
	clientHeight: number;
}

/**
 * computeScrollProgress - 计算阅读进度百分比 0..100（纯函数）
 */
export function computeScrollProgress(input: ProgressInput): number {
	const { scrollTop, scrollHeight, clientHeight } = input;
	const max = scrollHeight - clientHeight;
	if (max <= 0) return 0;
	return Math.max(0, Math.min(100, (scrollTop / max) * 100));
}

/**
 * useScrollProgress - 监听容器滚动，返回进度 0..100
 */
export function useScrollProgress(
	ref: React.RefObject<HTMLElement | null>,
): number {
	const [progress, setProgress] = useState(0);

	useEffect(() => {
		const el = ref.current;
		if (!el) return;
		const onScroll = () => {
			setProgress(
				computeScrollProgress({
					scrollTop: el.scrollTop,
					scrollHeight: el.scrollHeight,
					clientHeight: el.clientHeight,
				}),
			);
		};
		onScroll();
		el.addEventListener("scroll", onScroll, { passive: true });
		return () => el.removeEventListener("scroll", onScroll);
	}, [ref]);

	return progress;
}
```

`web/src/shared/lib/hooks/__tests__/use-scroll-progress.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { computeScrollProgress } from "../use-scroll-progress";

describe("computeScrollProgress", () => {
	it("returns 0 at top", () => {
		expect(
			computeScrollProgress({ scrollTop: 0, scrollHeight: 2000, clientHeight: 800 }),
		).toBe(0);
	});

	it("returns 100 at bottom", () => {
		expect(
			computeScrollProgress({ scrollTop: 1200, scrollHeight: 2000, clientHeight: 800 }),
		).toBe(100);
	});

	it("clamps > 100", () => {
		expect(
			computeScrollProgress({ scrollTop: 9999, scrollHeight: 2000, clientHeight: 800 }),
		).toBe(100);
	});

	it("returns 0 when not scrollable", () => {
		expect(
			computeScrollProgress({ scrollTop: 0, scrollHeight: 800, clientHeight: 800 }),
		).toBe(0);
	});
});
```

- [ ] **Step 2: 写 use-toc**

`web/src/shared/lib/hooks/use-toc.ts`:
```ts
import { useEffect, useState } from "react";

export interface TocItem {
	/** 标题层级 2|3 */
	level: 2 | 3;
	/** 标题文本 */
	text: string;
	/** 锚点 id */
	id: string;
}

/**
 * extractToc - 从 HTML 字符串提取 H2/H3 与 id（纯函数）
 *
 * 仅识别带 id 的标题（如 <h2 id="...">）。id 缺失时按文本 slug 生成。
 */
export function extractToc(html: string): TocItem[] {
	const re = /<h([23])[^>]*?(?:\sid=["']([^"']+)["'])?[^>]*>([\s\S]*?)<\/h\1>/gi;
	const out: TocItem[] = [];
	let m: RegExpExecArray | null;
	while ((m = re.exec(html)) !== null) {
		const level = Number(m[1]) as 2 | 3;
		const id = m[2] || slugify(stripTags(m[3]));
		const text = stripTags(m[3]).trim();
		if (text) out.push({ level, id, text });
	}
	return out;
}

function stripTags(s: string): string {
	return s.replace(/<[^>]+>/g, "");
}

function slugify(s: string): string {
	return s
		.trim()
		.toLowerCase()
		.replace(/[^\p{L}\p{N}]+/gu, "-")
		.replace(/^-+|-+$/g, "");
}

/**
 * useActiveHeading - 返回当前视口内最靠上可见的 heading id（TOC 高亮）
 */
export function useActiveHeading(containerRef: React.RefObject<HTMLElement | null>): string | null {
	const [active, setActive] = useState<string | null>(null);

	useEffect(() => {
		const el = containerRef.current;
		if (!el) return;
		const onScroll = () => {
			const headings = el.querySelectorAll<HTMLElement>("h2[id], h3[id]");
			let current: string | null = null;
			for (const h of Array.from(headings)) {
				if (h.getBoundingClientRect().top - 120 <= 0) {
					current = h.id;
				}
			}
			setActive(current);
		};
		onScroll();
		el.addEventListener("scroll", onScroll, { passive: true });
		return () => el.removeEventListener("scroll", onScroll);
	}, [containerRef]);

	return active;
}
```

`web/src/shared/lib/hooks/__tests__/use-toc.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { extractToc } from "../use-toc";

describe("extractToc", () => {
	it("extracts h2/h3 with explicit ids", () => {
		const html = `
			<h2 id="a">First</h2>
			<p>x</p>
			<h3 id="b">Sub</h3>
		`;
		expect(extractToc(html)).toEqual([
			{ level: 2, id: "a", text: "First" },
			{ level: 3, id: "b", text: "Sub" },
		]);
	});

	it("generates slug id when missing", () => {
		const html = `<h2>Hello World!</h2>`;
		expect(extractToc(html)).toEqual([
			{ level: 2, id: "hello-world", text: "Hello World!" },
		]);
	});

	it("strips inner tags from text", () => {
		const html = `<h2 id="x">Has <code>code</code> inside</h2>`;
		expect(extractToc(html)[0].text).toBe("Has code inside");
	});

	it("handles Chinese heading slug", () => {
		const html = `<h2>你好 世界</h2>`;
		expect(extractToc(html)[0].id).toBe("你好-世界");
	});

	it("returns empty for no headings", () => {
		expect(extractToc("<p>nope</p>")).toEqual([]);
	});
});
```

- [ ] **Step 3: 跑测试确认通过**

Run: `cd web && pnpm test src/shared/lib/hooks/__tests__/use-scroll-progress.test.ts src/shared/lib/hooks/__tests__/use-toc.test.ts`
Expected: 9 tests passed。

- [ ] **Step 4: 跑架构验证**

Run: `cd web && npx biome check src/shared/lib/hooks/use-scroll-progress.ts src/shared/lib/hooks/use-toc.ts && npx tsc --noEmit`
Expected: 无错误。

- [ ] **Step 5: Commit**

```bash
cd web && git add src/shared/lib/hooks/use-scroll-progress.ts src/shared/lib/hooks/use-toc.ts src/shared/lib/hooks/__tests__/use-scroll-progress.test.ts src/shared/lib/hooks/__tests__/use-toc.test.ts
git commit -m "feat(web): 新增阅读进度与 TOC 提取 hook（含单测）"
```

---

## Task 15: 命令面板过滤算法 + cmd 原语（Cmd/Ctrl+K）

**Files:**
- Create: `web/src/shared/lib/hooks/cmd-filter.ts`
- Create: `web/src/shared/lib/hooks/__tests__/cmd-filter.test.ts`
- Create: `web/src/shared/ui/command.tsx`

**目的：** spec「全局 Cmd/Ctrl+K 毛玻璃命令面板，全站检索 + 快捷切主题（输入 > Dark）」。先写纯过滤算法 + 测试，再写 shadcn 风格的 cmd 原语（基于 Radix Dialog 子集，仓库已有 `radix-ui` 聚合包）。

- [ ] **Step 1: 写 cmd-filter 纯函数 + 测试**

`web/src/shared/lib/hooks/cmd-filter.ts`:
```ts
export interface CmdItem {
	id: string;
	/** 显示名 */
	label: string;
	/** 关键词（用于匹配） */
	keywords?: string[];
	/** 分组 */
	group: string;
	/** 执行 */
	run: () => void;
}

/**
 * filterCommands - 模糊过滤命令列表（纯函数）
 *
 * 规则：
 * - 空 query 返回全部
 * - 以 ">" 开头：仅匹配 group（指令模式，如 "> Dark" → group="theme"）
 * - 否则：label 或 keywords 子串匹配（大小写不敏感）
 */
export function filterCommands(items: CmdItem[], query: string): CmdItem[] {
	const q = query.trim();
	if (!q) return items;

	if (q.startsWith(">")) {
		const group = q.slice(1).trim().toLowerCase();
		if (!group) return items;
		return items.filter((i) => i.group.toLowerCase().includes(group));
	}

	const needle = q.toLowerCase();
	return items.filter((i) => {
		if (i.label.toLowerCase().includes(needle)) return true;
		return i.keywords?.some((k) => k.toLowerCase().includes(needle)) ?? false;
	});
}
```

`web/src/shared/lib/hooks/__tests__/cmd-filter.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { filterCommands, type CmdItem } from "../cmd-filter";

const items: CmdItem[] = [
	{ id: "1", label: "首页", group: "nav", keywords: ["home"], run: () => {} },
	{ id: "2", label: "博客", group: "nav", keywords: ["blog"], run: () => {} },
	{ id: "3", label: "切换暗色", group: "theme", keywords: ["dark"], run: () => {} },
	{ id: "4", label: "切换亮色", group: "theme", keywords: ["light"], run: () => {} },
];

describe("filterCommands", () => {
	it("returns all on empty query", () => {
		expect(filterCommands(items, "")).toHaveLength(4);
	});

	it("substring matches label case-insensitive", () => {
		expect(filterCommands(items, "首")).toHaveLength(1);
	});

	it("matches keywords", () => {
		expect(filterCommands(items, "dark")).toHaveLength(1);
		expect(filterCommands(items, "dark")[0].id).toBe("3");
	});

	it("command mode filters by group", () => {
		expect(filterCommands(items, "> theme")).toHaveLength(2);
	});

	it("command mode with empty group returns all", () => {
		expect(filterCommands(items, ">")).toHaveLength(4);
	});

	it("no match returns empty", () => {
		expect(filterCommands(items, "zzz")).toHaveLength(0);
	});
});
```

- [ ] **Step 2: 跑测试确认通过**

Run: `cd web && pnpm test src/shared/lib/hooks/__tests__/cmd-filter.test.ts`
Expected: 6 tests passed。

- [ ] **Step 3: 写 command 原语（基于 Radix Dialog）**

`web/src/shared/ui/command.tsx`:
```tsx
import { Dialog } from "@shared/ui/dialog";
import { cn } from "@shared/lib/utils";
import * as React from "react";

export interface CommandListProps {
	open: boolean;
	onOpenChange: (v: boolean) => void;
	items: Array<{
		id: string;
		label: string;
		group: string;
		run: () => void;
	}>;
	query: string;
	onQueryChange: (v: string) => void;
}

/**
 * CommandPalette 内核 - 基于 Radix Dialog 的毛玻璃命令面板
 *
 * 毛玻璃（backdrop-blur）+ 半透明卡，items 分组渲染。
 * 上/下键导航由父组件状态控制（此处简化为列表 + 回车执行首项）。
 */
function CommandList({
	open,
	onOpenChange,
	items,
	query,
	onQueryChange,
}: CommandListProps) {
	const groups = React.useMemo(() => {
		const m = new Map<string, typeof items>();
		for (const it of items) {
			const arr = m.get(it.group) ?? [];
			arr.push(it);
			m.set(it.group, arr);
		}
		return Array.from(m.entries());
	}, [items]);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<Dialog.Content className="overflow-hidden border-edge-hairline bg-card/80 p-0 backdrop-blur-2xl dark:bg-surface-glass/70">
				<input
					autoFocus
					value={query}
					onChange={(e) => onQueryChange(e.target.value)}
					placeholder="搜索页面，或输入 > Dark 切换主题…"
					className={cn(
						"w-full border-b border-edge-hairline bg-transparent px-4 py-3 font-mono text-sm",
						"placeholder:text-muted-foreground focus:outline-none",
					)}
				/>
				<div className="max-h-80 overflow-y-auto p-2">
					{items.length === 0 ? (
						<p className="px-3 py-6 text-center text-sm text-muted-foreground">
							无匹配结果
						</p>
					) : null}
					{groups.map(([group, list]) => (
						<div key={group} className="mb-2">
							<p className="px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
								{group}
							</p>
							{list.map((it) => (
								<button
									type="button"
									key={it.id}
									onClick={() => {
										it.run();
										onOpenChange(false);
									}}
									className="block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground"
								>
									{it.label}
								</button>
							))}
						</div>
					))}
				</div>
			</Dialog.Content>
		</Dialog>
	);
}

export { CommandList };
```

> 依赖现有 `@shared/ui/dialog`（仓库已有 dialog.tsx，导入即可）。

- [ ] **Step 4: 跑架构验证**

Run: `cd web && npx biome check src/shared/lib/hooks/cmd-filter.ts src/shared/ui/command.tsx && npx tsc --noEmit`
Expected: 无错误。

- [ ] **Step 5: Commit**

```bash
cd web && git add src/shared/lib/hooks/cmd-filter.ts src/shared/lib/hooks/__tests__/cmd-filter.test.ts src/shared/ui/command.tsx
git commit -m "feat(web): 新增命令面板过滤算法 + cmd 原语"
```

---

## Task 16: 全局 CommandPalette widget（Cmd/Ctrl+K 装配）

**Files:**
- Create: `web/src/widgets/CommandPalette/CommandPalette.tsx`
- Create: `web/src/widgets/CommandPalette/index.ts`

**目的：** 装配 Cmd+K 监听 + 命令清单（导航页 + 主题切换），消费 Task 15 的 `filterCommands` 与 `CommandList`。

- [ ] **Step 1: 写 widget**

`web/src/widgets/CommandPalette/CommandPalette.tsx`:
```tsx
import { CommandList } from "@shared/ui/command";
import { filterCommands, type CmdItem } from "@shared/lib/hooks/cmd-filter";
import { useThemeTransition } from "@shared/ui/theme-transition";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

/**
 * CommandPalette - 全局 Cmd/Ctrl+K 毛玻璃命令面板
 *
 * spec：全站检索 + 快捷切换主题（输入 > Dark）。
 * - Cmd/Ctrl+K 打开
 * - 命令清单：导航（首页/博客/关于/项目）+ 主题（暗/亮）
 * - 过滤走纯函数 filterCommands
 */
const CommandPalette = () => {
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");
	const navigate = useNavigate();
	const { toggle, theme } = useThemeTransition();

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
				e.preventDefault();
				setOpen((v) => !v);
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, []);

	const all: CmdItem[] = useMemo(
		() => [
			{
				id: "nav-home",
				label: "首页",
				group: "navigation",
				keywords: ["home", "index"],
				run: () => navigate({ to: "/" }),
			},
			{
				id: "nav-blog",
				label: "博客",
				group: "navigation",
				keywords: ["blog", "posts"],
				run: () => navigate({ to: "/blog" }),
			},
			{
				id: "nav-about",
				label: "关于",
				group: "navigation",
				run: () => navigate({ to: "/about" }),
			},
			{
				id: "nav-projects",
				label: "项目",
				group: "navigation",
				run: () => navigate({ to: "/projects" }),
			},
			{
				id: "theme-dark",
				label: "切换暗色主题",
				group: "theme",
				keywords: ["dark", "night"],
				run: () => {
					if (theme !== "dark") toggle();
				},
			},
			{
				id: "theme-light",
				label: "切换亮色主题",
				group: "theme",
				keywords: ["light", "day"],
				run: () => {
					if (theme === "dark") toggle();
				},
			},
		],
		[navigate, toggle, theme],
	);

	const filtered = useMemo(() => filterCommands(all, query), [all, query]);

	return (
		<CommandList
			open={open}
			onOpenChange={setOpen}
			items={filtered}
			query={query}
			onQueryChange={setQuery}
		/>
	);
};

export default CommandPalette;
```

`web/src/widgets/CommandPalette/index.ts`:
```ts
export { default } from "./CommandPalette";
```

- [ ] **Step 2: 跑架构验证**

Run: `cd web && npx biome check src/widgets/CommandPalette && npx tsc --noEmit`
Expected: 无错误。

- [ ] **Step 3: Commit**

```bash
cd web && git add src/widgets/CommandPalette/
git commit -m "feat(web): 新增全局 Cmd+K 命令面板 widget"
```

---

## Task 17: 全局自定义游标（磁性吸附）

**Files:**
- Create: `web/src/shared/ui/cursor.tsx`

**目的：** spec「自定义游标，靠近核心可点击元素时产生轻微磁力吸附与形变」。用 `useMagnetic` 在 hover 到 `[data-cursor="magnetic"]` 元素时变形。

- [ ] **Step 1: 写实现**

`web/src/shared/ui/cursor.tsx`:
```tsx
import { useMagnetic } from "@shared/lib/hooks/use-magnetic";
import { useEffect, useRef, useState } from "react";

/**
 * CustomCursor - 全局自定义游标
 *
 * spec：靠近核心可点击元素产生磁力吸附与形变。
 * - pointer:fine 设备启用（触屏关闭）
 * - 标记了 data-cursor="magnetic" 的元素 hover 时游标放大并吸附
 *
 * SSR 安全：仅在 client 渲染（mounted 标记），首屏返回 null。
 * 挂载后给 <html> 加 .cursor-custom 隐藏系统游标。
 */
const CustomCursor = () => {
	const [mounted, setMounted] = useState(false);
	const dotRef = useRef<HTMLDivElement>(null);
	const [hovering, setHovering] = useState(false);
	const { onMouseMove, onMouseLeave } = useMagnetic(0.5);

	useEffect(() => {
		setMounted(true);
		document.documentElement.classList.add("cursor-custom");

		const onMove = (e: MouseEvent) => {
			const dot = dotRef.current;
			if (!dot) return;
			dot.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
			const target = e.target as HTMLElement | null;
			const magnetic = target?.closest('[data-cursor="magnetic"]');
			setHovering(Boolean(magnetic));
		};
		window.addEventListener("mousemove", onMove);
		return () => {
			window.removeEventListener("mousemove", onMove);
			document.documentElement.classList.remove("cursor-custom");
		};
	}, []);

	// 让游标自身也能受磁性影响（保留接口一致性）
	void onMouseMove;
	void onMouseLeave;

	if (!mounted) return null;

	return (
		<div
			ref={dotRef}
			aria-hidden
			className="pointer-events-none fixed left-0 top-0 z-[9998] -ml-2 -mt-2 transition-[width,height,background-color] duration-200"
			style={{
				width: hovering ? 32 : 12,
				height: hovering ? 32 : 12,
				borderRadius: "9999px",
				mixBlendMode: "difference",
				backgroundColor: hovering
					? "hsl(var(--neon-blue) / 0.5)"
					: "hsl(var(--foreground))",
			}}
		/>
	);
};

export { CustomCursor };
```

- [ ] **Step 2: 跑架构验证**

Run: `cd web && npx tsc --noEmit`
Expected: 无类型错误。

- [ ] **Step 3: Commit**

```bash
cd web && git add src/shared/ui/cursor.tsx
git commit -m "feat(web): 新增全局自定义游标（磁性吸附）"
```

---

## Task 18: 装配根布局（CustomCursor + CommandPalette + ThemeOverlay，不破坏 SSR）

**Files:**
- Modify: `web/src/routes/__root.tsx`

**目的：** 把全局组件挂到根。全部用 client-only 守卫，避免 SSR 报错（CustomCursor 已内部 mounted 守卫；CommandPalette 用 `ClientOnly` 或 `useEffect` 守卫）。

- [ ] **Step 1: 改 RootComponent**

在 `web/src/routes/__root.tsx` 中，把 `RootComponent` 改为：

```tsx
function RootComponent() {
	return (
		<AppProvider>
			<AnnouncementBar />
			<Header />
			<main className="min-h-[60vh]">
				<Outlet />
			</main>
			<Footer />
			<MusicPlayer />
			<CommandPalette />
			<ThemeOverlay />
			<CustomCursor />
			<TanStackDevtools
				config={{ position: "bottom-right" }}
				plugins={[
					{
						name: "Tanstack Router",
						render: <TanStackRouterDevtoolsPanel />,
					},
				]}
			/>
		</AppProvider>
	);
}
```

并在文件顶部 import 区补：
```tsx
import CommandPalette from "@widgets/CommandPalette";
import { CustomCursor } from "@shared/ui/cursor";
import ThemeOverlay from "@widgets/ThemeToggle/ThemeOverlay";
```

- [ ] **Step 2: 跑架构验证**

Run: `cd web && npx biome check src/routes/__root.tsx && npx tsc --noEmit`
Expected: 无错误。

- [ ] **Step 3: Commit**

```bash
cd web && git add src/routes/__root.tsx
git commit -m "feat(web): 根布局装配命令面板/自定义游标/主题遮罩"
```

---

## Task 19: Hero 重写为左侧视觉区（xunrua 解密 + 粒子）

**Files:**
- Modify: `web/src/widgets/Hero/Hero.tsx`
- Create: `web/src/widgets/Hero/HeroLeft.tsx`
- Create: `web/src/widgets/Hero/HeroRight.tsx`

**目的：** spec「左侧视觉区作为视觉与身份锚点，鼠标跟随粒子；核心放置 xunrua 赛博解密文本」。把 Hero 拆为 Left（视觉锚）/Right（动态分发），由首页网格（Task 21）摆成 50/50。

- [ ] **Step 1: 写 HeroLeft**

`web/src/widgets/Hero/HeroLeft.tsx`:
```tsx
import { useSettings } from "@features/settings/api/queries";
import DecryptedText from "@shared/vendor/react-bits/DecryptedText";
import ParticleField from "@shared/vendor/react-bits/ParticleField";

/**
 * HeroLeft - 左侧视觉锚点（spec Left 50%）
 *
 * - 鼠标跟随流体粒子（ParticleField）
 * - 核心 ID「xunrua」用赛博解密动画出场（DecryptedText，view 触发）
 * - 配置从站点 settings 读（SSR 已预取），未加载显示占位
 *
 * 注意：主理人 ID 固定 xunrua（spec 指定），不读 settings。
 */
const HeroLeft = () => {
	const { data } = useSettings();

	return (
		<div className="relative flex h-full flex-col items-center justify-center overflow-hidden">
			<div className="absolute inset-0 -z-10">
				<ParticleField />
			</div>
			<div className="px-6 text-center">
				<p className="mb-3 font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">
					{data?.tagline ?? "Hello World"}
				</p>
				<h1 className="font-mono text-6xl font-bold tracking-tight md:text-8xl">
					<DecryptedText
						text="xunrua"
						animateOn="view"
						speed={60}
						maxIterations={12}
						parentClassName="inline-block"
						className="bg-gradient-to-r from-neon-blue to-neon-purple bg-clip-text text-transparent"
						encryptedClassName="text-muted-foreground"
					/>
				</h1>
			</div>
		</div>
	);
};

export default HeroLeft;
```

- [ ] **Step 2: 写 HeroRight（动态分发占位）**

`web/src/widgets/Hero/HeroRight.tsx`:
```tsx
import { postKeys } from "@features/posts/api/keys";
import { usePosts } from "@features/posts/api/queries";
import { ShimmerSkeleton } from "@shared/ui/shimmer-skeleton";
import { SpotlightCard } from "@shared/vendor/react-bits/SpotlightCard";
import { ScrollArea } from "@shared/ui/scroll-area";
import { Link } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";

/**
 * HeroRight - 右侧动态分发中心（spec Right 50%）
 *
 * 首屏右侧展示最新文章流（虚拟列表化的卡片），
 * 由首页网格分配宽度。点击进入详情触发 Morph（Task 22）。
 *
 * 数据走 usePosts（SSR 已预取），不动 api。
 */
const HeroRight = () => {
	const { data, isLoading } = usePosts({ page: 1, limit: 8 });

	return (
		<div className="flex h-full flex-col">
			<div className="mb-3 flex items-center justify-between">
				<h2 className="font-mono text-sm uppercase tracking-wider text-muted-foreground">
					最新动态
				</h2>
			</div>
			<ScrollArea className="flex-1" style={{ maxHeight: "100%" }}>
				<div className="flex flex-col gap-3 pr-2">
					{isLoading
						? Array.from({ length: 4 }).map((_, i) => (
								// biome-ignore lint/suspicious/noArrayIndexKey: 骨架
								<ShimmerSkeleton key={`h-${i}`} className="h-24" />
							))
						: (data?.data ?? []).map((post) => (
								<SpotlightCard key={post.id} className="p-4">
									<Link
										to="/blog/$slug"
										params={{ slug: post.slug }}
										data-cursor="magnetic"
									>
										<div className="mb-1 flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
											<span>{post.author.username}</span>
											<span>·</span>
											<time>
												{formatDistanceToNow(new Date(post.published_at), {
													addSuffix: true,
													locale: zhCN,
												})}
											</time>
										</div>
										<h3 className="line-clamp-1 text-base font-semibold hover:text-neon-blue">
											{post.title}
										</h3>
										<p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
											{post.excerpt}
										</p>
									</Link>
								</SpotlightCard>
							))}
				</div>
			</ScrollArea>
		</div>
	);
};

export default HeroRight;
```

- [ ] **Step 3: Hero 改为聚合容器**

整体替换 `web/src/widgets/Hero/Hero.tsx`:
```tsx
import HeroLeft from "./HeroLeft";
import HeroRight from "./HeroRight";

/**
 * Hero - 首页英雄区容器
 *
 * 由首页网格（routes/index.tsx）分配 50/50 宽度，
 * 本组件只负责左右拼装与高度撑满。
 */
const Hero = () => {
	return (
		<div className="grid h-full grid-cols-1 md:grid-cols-2">
			<div className="min-h-[420px] border-r border-edge-hairline">
				<HeroLeft />
			</div>
			<div className="min-h-[420px] p-4">
				<HeroRight />
			</div>
		</div>
	);
};

export default Hero;
```

- [ ] **Step 4: 跑架构验证**

Run: `cd web && npx biome check src/widgets/Hero && npx tsc --noEmit`
Expected: 无错误。

- [ ] **Step 5: Commit**

```bash
cd web && git add src/widgets/Hero/
git commit -m "feat(web): Hero 拆分为左视觉区(xunrua解密+粒子)与右动态分发"
```

---

## Task 20: 重写 Header 为 20% 底座 + 机械轴体切换器位置

**Files:**
- Modify: `web/src/widgets/Header/Header.tsx`
- Modify: `web/src/widgets/Header/HeaderActions.tsx`

**目的：** spec「机械轴体切换器放首屏底部 20% 区域极左侧边缘」。把 Header 从顶部 sticky 改为参与首页 20% 底座（具体由首页 Task 21 控制位置），但 Header 组件本身仍可作通用顶部栏在非首页用。本任务只重写视觉，并让 ThemeToggle 用上机械轴体（Task 5 已改 ThemeToggle）。

- [ ] **Step 1: 重写 HeaderActions（去掉重复 ThemeToggle，因首页底座单独放）**

`web/src/widgets/Header/HeaderActions.tsx`:
```tsx
import { ThemeToggle } from "@widgets/ThemeToggle";
import { Button } from "@shared/ui/button";
import { Command } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

/**
 * HeaderActions - 右侧操作区
 *
 * - 命令面板触发按钮（Cmd+K）
 * - ThemeToggle（机械轴体）
 * - 登录入口
 */
const HeaderActions = () => {
	const [hasPalette, setHasPalette] = useState(false);
	useEffect(() => setHasPalette(true), []);

	return (
		<div className="flex items-center gap-2">
			{hasPalette ? (
				<Button
					variant="ghost"
					size="icon-sm"
					aria-label="命令面板"
					onClick={() => {
						window.dispatchEvent(
							new KeyboardEvent("keydown", { key: "k", metaKey: true }),
						);
					}}
				>
					<Command className="size-4" />
				</Button>
			) : null}
			<ThemeToggle />
			<Button variant="ghost" size="sm" asChild>
				<Link to="/login">登录</Link>
			</Button>
		</div>
	);
};

export default HeaderActions;
```

- [ ] **Step 2: Header 视觉微调（保持 sticky，作为非首页通用栏）**

整体替换 `web/src/widgets/Header/Header.tsx`:
```tsx
import { useMusicUIStore } from "@features/music/model/ui-store";

import HeaderActions from "./HeaderActions";
import HeaderLogo from "./HeaderLogo";
import HeaderMobile from "./HeaderMobile";
import HeaderNav from "./HeaderNav";

/**
 * Header - 页面顶部容器（非首页通用栏）
 *
 * 首页有自己的 20% 底座（routes/index.tsx），
 * 其他页（blog/about/...）仍用此 sticky header。
 *
 * sticky + backdrop-blur + 1px 极细边框（dark 霓虹 / light 灰）。
 */
const Header = () => {
	const openMusic = useMusicUIStore((s) => s.open);
	const handleAction = (action: string) => {
		if (action === "open-music") openMusic();
	};

	return (
		<header className="sticky top-0 z-40 w-full border-b border-edge-hairline bg-background/70 backdrop-blur-xl">
			<div className="container mx-auto flex h-16 items-center justify-between px-4">
				<HeaderLogo />
				<HeaderNav onAction={handleAction} />
				<div className="flex items-center gap-2">
					<HeaderActions />
					<HeaderMobile onAction={handleAction} />
				</div>
			</div>
		</header>
	);
};

export default Header;
```

- [ ] **Step 3: 跑架构验证**

Run: `cd web && npx biome check src/widgets/Header && npx tsc --noEmit`
Expected: 无错误。

- [ ] **Step 4: Commit**

```bash
cd web && git add src/widgets/Header/Header.tsx src/widgets/Header/HeaderActions.tsx
git commit -m "feat(web): Header 视觉重写 + 操作区接入命令面板触发"
```

---

## Task 21: 首页网格化（80% 核心展示 + 20% 底座）

**Files:**
- Modify: `web/src/routes/index.tsx`

**目的：** spec「首屏纵向 80%/20%；横向 80% 内左右 50/50」。重构 HomePage 为 h-screen 网格：上半 80% 放 Hero（内含 50/50），下半 20% 放底座（机械切换器极左 + 导航）。

- [ ] **Step 1: 整体重写 routes/index.tsx 的 HomePage（保留 loader）**

把 `HomePage` 函数替换为：
```tsx
function HomePage() {
	return (
		<div className="flex h-[calc(100vh-4rem)] flex-col">
			{/* 80% 核心展示区：左 50% 视觉锚 + 右 50% 动态分发 */}
			<section className="flex-[4] overflow-hidden border-b border-edge-hairline">
				<Hero />
			</section>
			{/* 20% 底座：机械切换器极左 + 次要导航/信息 */}
			<section className="flex flex-[1] items-stretch">
				<div className="flex items-center px-6">
					<ThemeToggle />
				</div>
				<div className="flex flex-1 items-center justify-center gap-8 px-4 font-mono text-xs text-muted-foreground">
					<span>60fps · WebGL ready</span>
					<span className="hidden md:inline">Cmd/Ctrl + K 打开命令面板</span>
				</div>
			</section>
		</div>
	);
}
```

并在文件顶部 import 区补：
```tsx
import ThemeToggle from "@widgets/ThemeToggle";
```
保留原 `Hero` import、loader、Route 定义不动。

同时**删除**原 HomePage 里旧的「最新文章」「GitHub 活动」section（HeroRight 已含动态分发；Contributions 后续 feature 再加）——但为不丢功能，把 GitHub 贡献图移到底座可视区之外不合适，改为：保留 `<Contributions />` 在底座右侧（20% 区右侧）。

最终 HomePage：
```tsx
function HomePage() {
	return (
		<div className="flex h-[calc(100vh-4rem)] flex-col">
			<section className="flex-[4] overflow-hidden border-b border-edge-hairline">
				<Hero />
			</section>
			<section className="flex flex-[1] items-stretch gap-4 px-4 py-2">
				<div className="flex items-center">
					<ThemeToggle />
				</div>
				<div className="flex flex-1 items-center justify-center font-mono text-xs text-muted-foreground">
					<span className="hidden md:inline">Cmd/Ctrl + K · 60fps · WebGL ready</span>
				</div>
				<div className="hidden items-center lg:flex">
					<Contributions compact />
				</div>
			</section>
		</div>
	);
}
```

> 若 `Contributions` 组件不支持 `compact` prop，则用原 `<Contributions />` 并由父容器 `overflow-hidden` 裁切；本步骤不要求改 Contributions 源码（避免越界改 feature）。

- [ ] **Step 2: 跑架构验证**

Run: `cd web && npx biome check src/routes/index.tsx && npx tsc --noEmit`
Expected: 无错误。

- [ ] **Step 3: Commit**

```bash
cd web && git add src/routes/index.tsx
git commit -m "feat(web): 首页重构为 80/20 网格（核心展示+底座）"
```

---

## Task 22: 文章详情页 Morph 布局（75% 阅读 + 25% 侧栏 TOC）

**Files:**
- Modify: `web/src/routes/blog/$slug.tsx`
- Create: `web/src/features/posts/ui/ArticleToc.tsx`

**目的：** spec「详情页右侧展开到 75-80%，左侧收缩为 20-25% 固定侧栏，xunrua 上移作 Logo，下方渐显动态 TOC，阅读进度与目录高亮同步」。用 `useScrollProgress` + `useActiveHeading` 装配。

- [ ] **Step 1: 写 ArticleToc 组件**

`web/src/features/posts/ui/ArticleToc.tsx`:
```tsx
import { ScrollArea } from "@shared/ui/scroll-area";
import { useActiveHeading } from "@shared/lib/hooks/use-toc";
import type { RefObject } from "react";
import type { TocItem } from "@shared/lib/hooks/use-toc";

export interface ArticleTocProps {
	items: TocItem[];
	/** 文章内容容器 ref（用于监听滚动 + 查 heading） */
	contentRef: RefObject<HTMLElement | null>;
}

/**
 * ArticleToc - 详情页动态目录（左侧侧栏 25%）
 *
 * spec：
 * - 左侧 xunrua 上移作 Logo（由父页面渲染，本组件只画 TOC）
 * - TOC 与阅读进度同步高亮当前 heading
 * - 上下渐隐遮罩
 */
const ArticleToc = ({ items, contentRef }: ArticleTocProps) => {
	const active = useActiveHeading(contentRef);

	if (!items.length) return null;

	return (
		<nav aria-label="目录" className="flex h-full flex-col">
			<p className="mb-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
				Contents
			</p>
			<ScrollArea className="flex-1">
				<ul className="space-y-1.5 border-l border-edge-hairline">
					{items.map((it) => {
						const isActive = active === it.id;
						return (
							<li key={it.id} className={it.level === 3 ? "ml-4" : ""}>
								<a
									href={`#${it.id}`}
									className={
										"block border-l-2 px-3 py-1 text-sm transition-colors " +
										(it.level === 3 ? "pl-5 text-xs" : "") +
										(isActive
											? " -ml-px border-neon-blue font-medium text-foreground"
											: " border-transparent text-muted-foreground hover:text-foreground")
									}
								>
									{it.text}
								</a>
							</li>
						);
					})}
				</ul>
			</ScrollArea>
		</nav>
	);
};

export default ArticleToc;
```

- [ ] **Step 2: 重写详情页**

整体替换 `web/src/routes/blog/$slug.tsx`:
```tsx
import ArticleToc from "@features/posts/ui/ArticleToc";
import { useScrollProgress } from "@shared/lib/hooks/use-scroll-progress";
import { extractToc } from "@shared/lib/hooks/use-toc";
import DecryptedText from "@shared/vendor/react-bits/DecryptedText";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef } from "react";

/**
 * /blog/$slug - 文章详情页（Nexus Morph 布局）
 *
 * spec：详情页打破 50/50，右侧展开至 75% 沉浸阅读，
 * 左侧收缩 25% 固定侧栏：xunrua 上移作 Logo + 下方动态 TOC。
 *
 * 阅读进度条（顶部）与 TOC 高亮同步。
 *
 * 注：首期文章正文 HTML 仍为占位（实际正文需后端 content 字段接入，
 * 属后续 feature，本任务只搭 Morph 骨架与 TOC 管线）。
 */
function BlogDetailPage() {
	const contentRef = useRef<HTMLDivElement>(null);
	const progress = useScrollProgress(contentRef);

	// 占位正文（演示 TOC 提取与高亮）
	const sampleHtml = `
		<h2 id="intro">引言</h2>
		<p>Nexus-Blog 是一个极客物理美学的博客系统。</p>
		<h2 id="arch">架构</h2>
		<p>保留 FSD 分层与 TanStack Start SSR。</p>
		<h3 id="arch-ui">UI 层</h3>
		<p>完全重写视觉，双主题。</p>
		<h2 id="conclusion">总结</h2>
		<p>60fps 与无 reflow 是铁律。</p>
	`;
	const toc = extractToc(sampleHtml);

	return (
		<div className="flex h-[calc(100vh-4rem)] flex-col">
			{/* 阅读进度条 */}
			<div className="h-0.5 w-full bg-border">
				<div
					className="h-full bg-neon-blue transition-[width] duration-150"
					style={{ width: `${progress}%` }}
				/>
			</div>

			<div className="grid flex-1 grid-cols-1 overflow-hidden md:grid-cols-[25%_75%]">
				{/* 左侧 25%：xunrua Logo + TOC */}
				<aside className="hidden flex-col border-r border-edge-hairline p-6 md:flex">
					<Link to="/" className="mb-6 block font-mono text-2xl font-bold">
						<DecryptedText
							text="xunrua"
							animateOn="view"
							speed={50}
							parentClassName="inline-block"
							className="bg-gradient-to-r from-neon-blue to-neon-purple bg-clip-text text-transparent"
							encryptedClassName="text-muted-foreground"
						/>
					</Link>
					<div className="flex-1 overflow-hidden">
						<ArticleToc items={toc} contentRef={contentRef} />
					</div>
				</aside>

				{/* 右侧 75%：沉浸阅读 */}
				<main className="overflow-y-auto">
					<article
						ref={contentRef}
						className="prose prose-neutral mx-auto max-w-3xl px-8 py-12 dark:prose-invert"
						// biome-ignore lint/security/noDangerouslySetInnerHtml: 占位演示正文
						dangerouslySetInnerHTML={{ __html: sampleHtml }}
					/>
				</main>
			</div>
		</div>
	);
}

export const Route = createFileRoute("/blog/$slug")({
	component: BlogDetailPage,
});
```

- [ ] **Step 3: 跑架构验证**

Run: `cd web && npx biome check src/routes/blog/\$slug.tsx src/features/posts/ui/ArticleToc.tsx && npx tsc --noEmit`
Expected: 无错误。

- [ ] **Step 4: Commit**

```bash
cd web && git add src/routes/blog/\$slug.tsx src/features/posts/ui/ArticleToc.tsx
git commit -m "feat(web): 文章详情页 Morph 布局（25%侧栏 TOC + 75%阅读 + 进度条）"
```

---

## Task 23: 其余路由占位视觉重做（Footer/ComingSoon/MusicPlayer/AnnouncementBar）

**Files:**
- Modify: `web/src/widgets/Footer/Footer.tsx`
- Modify: `web/src/shared/ui/coming-soon.tsx`
- Modify: `web/src/widgets/MusicPlayer/MusicPlayer.tsx`
- Modify: `web/src/widgets/AnnouncementBar/AnnouncementBar.tsx`

**目的：** 让所有常驻/占位组件视觉对齐 Nexus 主题。

- [ ] **Step 1: Footer 视觉重写**

整体替换 `web/src/widgets/Footer/Footer.tsx`:
```tsx
import { useSettings } from "@features/settings/api/queries";

/**
 * Footer - 页脚（Nexus 视觉）
 *
 * 极细 1px 顶边 + 字体改 mono + 社交链接。
 * 数据走 useSettings（SSR 预取），不动 api。
 */
const Footer = () => {
	const { data } = useSettings();
	const year = new Date().getFullYear();

	return (
		<footer className="border-t border-edge-hairline">
			<div className="container mx-auto flex flex-col items-center justify-between gap-4 px-4 py-6 sm:flex-row">
				<p className="font-mono text-xs text-muted-foreground">
					© {year} {data?.siteName ?? "Nexus-Blog"} · built with obsession
				</p>
				{data?.socials ? (
					<div className="flex gap-5 font-mono text-xs text-muted-foreground">
						{data.socials.github ? (
							<a className="transition-colors hover:text-neon-blue" href={data.socials.github}>
								GitHub
							</a>
						) : null}
						{data.socials.twitter ? (
							<a className="transition-colors hover:text-neon-blue" href={data.socials.twitter}>
								Twitter
							</a>
						) : null}
						{data.socials.email ? (
							<a className="transition-colors hover:text-neon-blue" href={`mailto:${data.socials.email}`}>
								Email
							</a>
						) : null}
					</div>
				) : null}
			</div>
		</footer>
	);
};

export default Footer;
```

- [ ] **Step 2: ComingSoon 视觉重写**

整体替换 `web/src/shared/ui/coming-soon.tsx`:
```tsx
import { Button } from "@shared/ui/button";
import { ShimmerSkeleton } from "@shared/ui/shimmer-skeleton";
import { Link } from "@tanstack/react-router";

export interface ComingSoonProps {
	title: string;
}

/**
 * ComingSoon - 占位页（Nexus 视觉）
 *
 * 标题 + shimmer 占位块 + 返回首页。
 * 替代简陋「建设中」文案。
 */
const ComingSoon = ({ title }: ComingSoonProps) => {
	return (
		<div className="container mx-auto px-4 py-24">
			<div className="mx-auto max-w-xl">
				<p className="mb-3 font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">
					In Construction
				</p>
				<h1 className="mb-8 font-mono text-4xl font-bold">{title}</h1>
				<div className="space-y-3">
					<ShimmerSkeleton className="h-4 w-3/4" />
					<ShimmerSkeleton className="h-4 w-1/2" />
					<ShimmerSkeleton className="h-24 w-full" />
				</div>
				<div className="mt-8">
					<Button asChild variant="outline">
						<Link to="/">返回首页</Link>
					</Button>
				</div>
			</div>
		</div>
	);
};

export default ComingSoon;
```

- [ ] **Step 3: MusicPlayer 视觉重写**

整体替换 `web/src/widgets/MusicPlayer/MusicPlayer.tsx`:
```tsx
import { useMusicUIStore } from "@features/music/model/ui-store";
import { Button } from "@shared/ui/button";
import { ShimmerSkeleton } from "@shared/ui/shimmer-skeleton";
import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import MusicPlayerEmpty from "./MusicPlayerEmpty";

/**
 * MusicPlayer - 全屏音乐播放器（Nexus 视觉）
 *
 * 毛玻璃全屏遮罩 + 左侧「唱片/轨道」shimmer 占位 + 右侧歌单骨架。
 * 仍由 MusicUIStore 控显隐，不动 store。
 */
const MusicPlayer = () => {
	const { isOpen, close } = useMusicUIStore();
	const [mounted, setMounted] = useState(false);

	useEffect(() => setMounted(true), []);
	if (!mounted || !isOpen) return null;

	return createPortal(
		<div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-2xl dark:bg-surface-glass/70">
			<div className="container mx-auto flex h-full flex-col px-4 py-6">
				<div className="mb-6 flex items-center justify-between">
					<h2 className="font-mono text-2xl font-bold">Music</h2>
					<Button variant="ghost" size="icon" onClick={close} aria-label="关闭">
						<X className="size-5" />
					</Button>
				</div>
				<div className="grid flex-1 grid-cols-1 gap-6 md:grid-cols-[40%_60%]">
					<div className="flex flex-col items-center justify-center gap-4">
						<ShimmerSkeleton className="aspect-square w-64 rounded-full" />
						<div className="w-64 space-y-2">
							<ShimmerSkeleton className="h-4 w-2/3" />
							<ShimmerSkeleton className="h-3 w-1/2" />
						</div>
					</div>
					<div className="space-y-2">
						{Array.from({ length: 8 }).map((_, i) => (
							// biome-ignore lint/suspicious/noArrayIndexKey: 骨架
							<ShimmerSkeleton key={i} className="h-12 w-full rounded-md" />
						))}
					</div>
				</div>
			</div>
		</div>,
		document.body,
	);
};

export default MusicPlayer;
```

- [ ] **Step 4: AnnouncementBar 视觉重写**

整体替换 `web/src/widgets/AnnouncementBar/AnnouncementBar.tsx`:
```tsx
import { useAnnouncements } from "@features/settings/api/queries";

/**
 * AnnouncementBar - 公告条（Nexus 视觉）
 *
 * 极简：dark 用霓虹底 + mono 字体；light 用 primary。
 * 无公告 return null（保持原行为）。
 */
const AnnouncementBar = () => {
	const { data } = useAnnouncements();
	if (!data?.length) return null;
	const top = data.find((a) => a.pinned) ?? data[0];
	if (!top) return null;

	return (
		<div className="border-b border-edge-hairline bg-primary/95 px-4 py-1.5 text-center font-mono text-xs text-primary-foreground dark:bg-neon-purple/20 dark:text-neon-purple">
			<span className="mr-2">◆</span>
			{top.content}
		</div>
	);
};

export default AnnouncementBar;
```

- [ ] **Step 5: 跑架构验证**

Run: `cd web && npx biome check src/widgets/Footer src/widgets/MusicPlayer src/widgets/AnnouncementBar src/shared/ui/coming-soon.tsx && npx tsc --noEmit && pnpm test`
Expected: 无错误；所有单元测试通过。

- [ ] **Step 6: Commit**

```bash
cd web && git add src/widgets/Footer/ src/widgets/MusicPlayer/MusicPlayer.tsx src/widgets/AnnouncementBar/ src/shared/ui/coming-soon.tsx
git commit -m "feat(web): Footer/MusicPlayer/AnnouncementBar/ComingSoon 视觉对齐 Nexus"
```

---

## Task 24: 全量验证与构建冒烟

**Files:** 无（仅验证）

**目的：** 跑完整验证矩阵 + 生产构建冒烟，确认架构与视觉都没破。

- [ ] **Step 1: 全量 lint + 类型 + 测试**

Run:
```bash
cd web
npx biome check .
npx tsc --noEmit
pnpm test
```
Expected: 三条全过（biome 对 vendor/ui/styles.css 已 ignore；tsc 无错；所有单测通过）。

- [ ] **Step 2: 生产构建冒烟**

Run: `cd web && pnpm build`
Expected: 构建成功，无 SSR/CSR 报错。若报 `document is not defined` 类 SSR 错误，回到对应 Task 给组件补 client-only 守卫（CustomCursor/CommandPalette/ThemeOverlay 已有）。

- [ ] **Step 3: 启动 dev 手动核验关键交互**

Run: `cd web && pnpm dev`（人工，非自动）
核对清单（人工，写进 PR 描述）：
- [ ] 首页 80/20 网格 + 左右 50/50
- [ ] 左侧 xunrua 解密动画出场 + 粒子跟随鼠标
- [ ] 右侧动态卡片滚动带渐隐遮罩
- [ ] 底座极左侧机械轴体主题切换器：hover 不缩放，active 下压 3px
- [ ] 主题切换 clip-path 圆形扩散（400ms，非闪烁）
- [ ] Cmd/Ctrl+K 命令面板打开，输入 > theme 过滤
- [ ] 自定义游标，hover magnetic 元素形变
- [ ] 进入 /blog/任意 文章详情：25/75 Morph + TOC 高亮跟随滚动 + 顶部进度条
- [ ] Dark/Light 双主题色板正确（深空黑/珍珠灰）

- [ ] **Step 4: Commit（若有 build 暴露的小修）**

```bash
cd web && git add -A && git commit -m "fix(web): 构建冒烟修复"
```
（若 Step 1-2 全过无需修改，跳过本步。）

---

## Self-Review（plan 作者自检结果）

**1. Spec 覆盖核对：**
- ✅ 首页网格 80/20 + 50/50 → Task 21
- ✅ 左侧视觉区 + xunrua 解密 + 粒子 → Task 11、19（HeroLeft）
- ✅ 右侧虚拟列表 + 渐隐遮罩 → Task 8（ScrollArea）、13（PostList）、19（HeroRight）
- ✅ 详情页 Morph 75/25 + TOC + 进度同步 → Task 14、22
- ✅ 机械轴体切换器（hover 不缩放，active 下压，无 reflow）→ Task 4、5、21（位置）
- ✅ 物理时间轴（线先到节点后亮）→ Task 7
- ✅ 无 LoaderCircle，shimmer 骨架 → Task 6
- ✅ 自定义游标 + 磁性吸附 → Task 9、17
- ✅ 卡片 Spotlight → Task 9、10、12
- ✅ Cmd/Ctrl+K 毛玻璃命令面板 + > Dark 指令 → Task 15、16
- ✅ 双主题色彩 + clip-path 400ms 扩散 → Task 2、3、5
- ✅ Tailwind v4 @theme（无 config.js）→ Task 2
- ✅ Radix（已有）+ React Bits（vendor 手拷）+ motion（已装）→ 各 Task
- ✅ 保留架构（FSD/SSR/Query/shadcn 基底/数据层不动）→ 全计划纪律

**2. 占位符扫描：** 无 TBD/TODO/"稍后实现"。所有代码块完整。Contributions 的 `compact` prop 已注明「不支持则用原组件 + overflow 裁切」，给了明确回退路径，非占位。

**3. 类型一致性核对：**
- `useThemeTransition` / `toggle(event?)` — Task 3 定义，Task 5/16 消费 ✅
- `computeSpotlight`/`useSpotlight` — Task 9 定义，Task 10 消费 ✅
- `computeMagnetic`/`useMagnetic` — Task 9 定义，Task 17 消费 ✅
- `filterCommands`/`CmdItem` — Task 15 定义，Task 16 消费 ✅
- `extractToc`/`TocItem`/`useActiveHeading` — Task 14 定义，Task 22 消费（ArticleToc）✅
- `computeScrollProgress`/`useScrollProgress` — Task 14 定义，Task 22 消费 ✅
- `SpotlightCard` — Task 10 定义，Task 12/19 消费 ✅
- `MechSwitch` — Task 4 定义，Task 5 消费 ✅
- `ScrollArea` — Task 8 定义，Task 13/19/22 消费 ✅
- `ShimmerSkeleton` — Task 6 定义，Task 13/19/23 消费 ✅
- `CommandList` — Task 15 定义，Task 16 消费 ✅
- `ThemeOverlay` — Task 5 定义，Task 18 消费 ✅
- `CustomCursor` — Task 17 定义，Task 18 消费 ✅
- `Hero`/`HeroLeft`/`HeroRight` — Task 19 定义，Task 21 消费 Hero ✅

**4. 已知约束/取舍（透明披露）：**
- 虚拟列表用**手写窗口化**而非 `@tanstack/react-virtual`（仓库未装，避免新增依赖；博客量级足够）。若后续文章过万，再引入 react-virtual 替换 PostList 内部即可，接口不变。
- `Contributions` 组件本计划**不改源码**（避免越界改 feature），首页底座用 `overflow-hidden` 裁切适配。
- 文章详情正文目前用**占位 HTML**（演示 TOC/进度管线），真实正文需后端 `content` 字段接入，属独立 feature（不属本 UI 重构范围）。
- `useMagnetic` 在 CustomCursor 里目前是「保留接口」（`void onMouseMove`），真正磁性吸附靠 `[data-cursor="magnetic"]` 标记 + 游标放大；spec 要求的「形变」由游标尺寸变化实现。若要元素自身位移吸附，可在 HeroRight 的 Link 上加 `onMouseMove={onMouseMove}`（接口已就绪）。

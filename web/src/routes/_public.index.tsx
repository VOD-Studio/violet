import { createFileRoute } from "@tanstack/react-router";

// 首页路由 (/)
//
// 2.0 重构期占位：展示主题切换、品牌色 token 生效。
// 真实首页（Hero + 近期文章）将在 Phase 4 用 ReactBits 视觉重设计时实现。

import { ThemeToggle } from "@/components/ThemeToggle";

function Home() {
  return (
    <div className="min-h-svh bg-gradient-to-br from-background via-background to-[oklch(var(--brand)/0.12)]">
      <header className="flex items-center justify-end p-4">
        <ThemeToggle />
      </header>
      <main className="mx-auto flex max-w-3xl flex-col items-center gap-6 px-4 py-24 text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
          <span className="size-1.5 rounded-full bg-brand" />
          2.0 开发中 · TanStack Router 已就绪
        </span>
        <h1 className="bg-gradient-to-r from-brand to-accent-brand bg-clip-text text-5xl font-bold text-transparent sm:text-6xl">
          Blog Project
        </h1>
        <p className="max-w-xl text-balance text-muted-foreground">
          前端正在用 TanStack 全家桶 + ReactBits 组件库重新设计。
          当前是路由骨架迁移的验证里程碑。
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground">
          <code className="rounded-md border border-border bg-card px-2 py-1">
            @tanstack/react-router
          </code>
          <code className="rounded-md border border-border bg-card px-2 py-1">
            next-themes
          </code>
          <code className="rounded-md border border-border bg-card px-2 py-1">
            three.js (待用)
          </code>
        </div>
      </main>
    </div>
  );
}

export const Route = createFileRoute("/_public/")({
  component: Home,
});

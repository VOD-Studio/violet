import { createFileRoute } from "@tanstack/react-router";

// 首页路由 (/)
//
// 2.0 用 ReactBits 组件重设计：Aurora 极光背景 + GradientText 渐变标题 +
// DecryptedText 解密副标题。展示 reactbits.dev 接入后的视觉效果。

import Aurora from "@/components/reactbits/backgrounds/Aurora";
import DecryptedText from "@/components/reactbits/text-animations/DecryptedText";
import GradientText from "@/components/reactbits/text-animations/GradientText";
import { ThemeToggle } from "@/components/ThemeToggle";

function Home() {
  return (
    <div className="relative min-h-svh overflow-hidden bg-background">
      {/* ReactBits Aurora 极光背景，使用品牌色 token */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <Aurora
          colorStops={["#5227FF", "#7CFF67", "#5227FF"]}
          amplitude={1.0}
          blend={0.5}
        />
      </div>

      <header className="relative flex items-center justify-end p-4">
        <ThemeToggle />
      </header>

      <main className="relative mx-auto flex min-h-[80vh] max-w-3xl flex-col items-center justify-center gap-8 px-4 text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
          <span className="size-1.5 rounded-full bg-brand" />
          2.0 开发中 · ReactBits + TanStack 已就绪
        </span>

        {/* ReactBits GradientText：流动渐变标题 */}
        <GradientText
          colors={["#5227FF", "#FF9FFC", "#B497CF", "#5227FF"]}
          animationSpeed={6}
          className="text-5xl font-bold tracking-tight sm:text-7xl"
        >
          Blog Project
        </GradientText>

        {/* ReactBits DecryptedText：解密动画副标题，进入视口触发 */}
        <p className="max-w-xl text-balance text-lg text-muted-foreground">
          <DecryptedText
            text="前端正在用 TanStack 全家桶 + ReactBits 组件库重新设计"
            animateOn="view"
            speed={60}
            maxIterations={8}
            sequential
            revealDirection="start"
          />
        </p>

        <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground">
          <code className="rounded-md border border-border bg-card px-2 py-1">
            @tanstack/react-router
          </code>
          <code className="rounded-md border border-border bg-card px-2 py-1">
            reactbits.dev
          </code>
          <code className="rounded-md border border-border bg-card px-2 py-1">
            next-themes
          </code>
          <code className="rounded-md border border-border bg-card px-2 py-1">
            ogl (Aurora)
          </code>
        </div>
      </main>
    </div>
  );
}

export const Route = createFileRoute("/_public/")({
  component: Home,
});

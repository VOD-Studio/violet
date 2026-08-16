import ArticleContent from "@shared/ui/markdown-preview/ArticleContent";
import { Calendar, Eye } from "lucide-react";
import type { ReactNode, RefObject } from "react";
import { BackLink } from "./BackLink";

const DEMO_MARKDOWN = [
	"返回入口的传统位置在文章头之上，阅读到中段后完全离场——退路应该跟着读者走，还是留在原地等读者回来。",
	"## 评价维度",
	"评价一个返回方案，通常看三件事：",
	"- 可达性：滚动后仍然找得到",
	"- 干扰度：不挡正文、不抢注意力",
	"- 可发现性：第一次来的用户能不能意识到它能点",
	"## 触发时机",
	"滚动演示区可以自由上下滚动，观察各方向的触发时机与动效手感。演示文本不承载信息量，只负责制造足够长的阅读距离。",
	"> 演示正文复用生产的 ArticleContent 渲染，排版与真实文章页一致。",
].join("\n\n");

/**
 * DemoStage - 演示滚动舞台
 *
 * 结构要点：滚动容器只装内容，浮层（返回钮/胶囊/进度线）必须放在
 * wrapper 的兄弟位——absolute 若挂在滚动容器内部，会锚到内容底而非
 * 视口底，滚动时跟着内容跑走。tabIndex 让容器可键盘聚焦滚动。
 */
export function DemoStage({
	scrollRef,
	overlay,
	children,
}: {
	scrollRef: RefObject<HTMLDivElement | null>;
	overlay?: ReactNode;
	children: ReactNode;
}) {
	return (
		<div className="relative">
			<div
				ref={scrollRef}
				// WAI-ARIA APG 可滚动区域模式：tabIndex 让键盘用户可聚焦滚动
				// biome-ignore lint/a11y/noNoninteractiveTabindex: role=region + aria-label + tabIndex 是 APG 认可的键盘可滚区域模式
				tabIndex={0}
				role="region"
				aria-label="返回导航演示滚动区"
				className="h-140 overflow-y-auto rounded-xl border border-edge-hairline bg-background/60 outline-none focus-visible:ring-2 focus-visible:ring-ring"
			>
				{children}
			</div>
			{overlay}
		</div>
	);
}

/**
 * DemoHeader - 演示文章头（结构对齐 /blog/$slug 的文章头）
 */
export function DemoHeader() {
	return (
		<header className="mx-auto mb-12 max-w-3xl px-6 pt-16 md:px-10">
			<BackLink label="博客" className="mb-8" />
			<div className="mb-4 flex flex-wrap gap-2">
				{["演示", "返回导航"].map((tag) => (
					<span
						key={tag}
						className="rounded-full bg-muted px-2.5 py-0.5 font-mono text-xs text-muted-foreground"
					>
						#{tag}
					</span>
				))}
			</div>
			<h2 className="mb-3 font-mono text-4xl font-bold leading-tight tracking-tight md:text-5xl">
				长文阅读的返回问题
			</h2>
			<div className="flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-sm text-muted-foreground">
				<span>super</span>
				<span className="inline-flex items-center gap-1.5">
					<Calendar className="size-3.5" />
					2026 年 8 月 16 日
				</span>
				<span className="inline-flex items-center gap-1.5">
					<Eye className="size-3.5" />
					128 次阅读
				</span>
			</div>
		</header>
	);
}

/** DemoBody - 演示正文（ArticleContent + prose，与生产排版一致；重复三遍制造滚动距离） */
export function DemoBody() {
	return (
		<main className="prose prose-neutral dark:prose-invert mx-auto min-w-0 max-w-3xl px-6 md:px-10">
			<ArticleContent content={[DEMO_MARKDOWN, DEMO_MARKDOWN, DEMO_MARKDOWN].join("\n\n")} />
		</main>
	);
}

/**
 * DemoArticle - 返回导航实验室的共享演示长文
 *
 * 排版对齐生产文章页：mono 大标题 + 标签药丸 + 作者/日期/阅读量 meta +
 * ArticleContent prose 正文。end 槽位留给内容锚点类方向。
 */
export function DemoArticle({ end }: { end?: ReactNode }) {
	return (
		<div className="pb-16">
			<DemoHeader />
			<DemoBody />
			{end}
		</div>
	);
}

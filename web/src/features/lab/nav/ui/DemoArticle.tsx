import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";

const PARAGRAPHS = [
	"这是一段用于撑起滚动高度的演示文本。返回导航方案必须在真实的滚动行为下评估：滚出多远后出现、出现时遮住多少内容、拇指能否自然够到。",
	"评价一个返回方案，通常看三件事：可达性（滚动后仍然找得到）、干扰度（不挡正文、不抢注意力）、可发现性（第一次来的用户能不能意识到它能点）。",
	"顶部返回链接的传统位置在文章头之上，阅读到中段后就完全离场，这正是本实验室要解决的问题：退路应该跟着读者走，还是留在原地等读者回来。",
	"滚动演示区可以自由上下滚动，观察各方向的触发时机与动效手感。演示文本不承载信息量，只负责制造足够长的阅读距离。",
];

/**
 * DemoHeader - 演示文章头
 *
 * 拆出独立组件供吸顶方向在标题后插哨兵：文章头滚出容器视口顶即触发。
 */
export function DemoHeader() {
	return (
		<header className="px-6 pt-8 mb-10 md:px-10">
			<p className="inline-flex cursor-pointer items-center gap-1.5 text-sm text-muted-foreground">
				<ArrowLeft className="size-4" />
				博客
			</p>
			<h3 className="mt-6 max-w-2xl text-2xl leading-snug font-bold tracking-tight md:text-3xl">
				长文阅读的返回问题：滚动之后，退路在哪里
			</h3>
			<p className="mt-3 font-mono text-[11px] text-muted-foreground">
				super · 2026-08-16 · 演示数据
			</p>
		</header>
	);
}

/** DemoBody - 演示正文（重复一遍制造足够长的滚动距离） */
export function DemoBody() {
	return (
		<div className="max-w-2xl space-y-5 px-6 text-[15px] leading-relaxed text-muted-foreground md:px-10">
			{/* 段落内容会重复一遍，key 只能用下标 */}
			{[...PARAGRAPHS, ...PARAGRAPHS].map((text, i) => (
				<p key={i}>{text}</p>
			))}
		</div>
	);
}

/**
 * DemoArticle - 返回导航实验室的共享演示长文
 *
 * 模拟文章详情页的阅读语境：顶部「← 博客」返回链接 + 标题 + 元信息 +
 * 多段正文。滚动容器由各方向组件自持（要挂 ref / 哨兵），本文只负责
 * 内容。end 槽位给文末返回块这类内容锚点方向用。
 */
export function DemoArticle({ end }: { end?: ReactNode }) {
	return (
		<div className="pb-10">
			<DemoHeader />
			<DemoBody />
			{end}
		</div>
	);
}

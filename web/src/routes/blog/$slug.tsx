import ArticleToc from "@features/posts/ui/ArticleToc";
import { useScrollProgress } from "@shared/lib/hooks/use-scroll-progress";
import { extractToc } from "@shared/lib/hooks/use-toc";
import { createFileRoute } from "@tanstack/react-router";
import { useRef } from "react";

/**
 * /blog/$slug - 文章详情页（Nexus Morph 布局）
 *
 * spec：详情页打破 50/50，右侧展开至 75% 沉浸阅读，
 * 左侧收缩 25% 固定侧栏：xunrua 上移作 Logo + 下方动态 TOC。
 *
 * 阅读进度条（顶部）与 TOC 高亮同步。
 *
 * 注：首期文章正文 HTML 仍为占位（演示 TOC 提取与高亮管线），
 * 实际正文需后端 content 字段接入（属后续 feature）。
 */
function BlogDetailPage() {
	const contentRef = useRef<HTMLElement>(null);
	const progress = useScrollProgress(contentRef);

	// 占位正文（演示 TOC 提取与高亮管线）
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
		<>
			{/* Fluid Progress Indicator */}
			<div className="fixed top-0 left-0 right-0 z-50 h-1">
				<div
					className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-[width] duration-150"
					style={{ width: `${progress}%` }}
				/>
			</div>

			<div className="container mx-auto px-6 py-24 flex justify-center">
				{/* Right side floating TOC (optional/hidden on small screens) */}
				<aside className="hidden xl:block fixed left-12 top-32 w-64">
					{/* TOC component */}
					<ArticleToc items={toc} contentRef={contentRef} />
				</aside>

				<main ref={contentRef} className="w-full max-w-3xl">
					<article
						className="prose prose-neutral dark:prose-invert max-w-none"
						// biome-ignore lint/security/noDangerouslySetInnerHtml: 占位演示正文
						dangerouslySetInnerHTML={{ __html: sampleHtml }}
					/>
				</main>
			</div>
		</>
	);
}

export const Route = createFileRoute("/blog/$slug")({
	component: BlogDetailPage,
});

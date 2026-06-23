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
 * 注：首期文章正文 HTML 仍为占位（演示 TOC 提取与高亮管线），
 * 实际正文需后端 content 字段接入（属后续 feature）。
 */
function BlogDetailPage() {
	const contentRef = useRef<HTMLDivElement>(null);
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

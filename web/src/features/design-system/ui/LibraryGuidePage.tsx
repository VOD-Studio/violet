import { notFound } from "@tanstack/react-router";
import { Suspense } from "react";
import { DESIGN_SYSTEM_CATALOG } from "../model/guides";
import { GuideTocLayout } from "./LibraryGuideToc";
import { GUIDE_CONTENT } from "./library-guides/registry";

/** 正文加载占位：与指南页排版同宽，避免标题与正文间跳变。 */
function GuideFallback() {
	return (
		<div className="space-y-4" aria-busy="true">
			<div className="h-4 w-1/3 rounded-xs bg-muted" />
			<div className="h-3 w-2/3 rounded-xs bg-muted/70" />
			<div className="h-3 w-1/2 rounded-xs bg-muted/50" />
		</div>
	);
}

/** 指南页头：分组眉题 + 标题 + 范围说明 */
function GuideHeader({ group, guide }: { group: string; guide: { title: string; scope: string } }) {
	return (
		<header className="space-y-3 border-b border-border/60 pb-8">
			<p className="font-serif text-sm text-muted-foreground">营造法式 / {group}</p>
			<h1 className="font-serif text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
				{guide.title}
			</h1>
			<p className="max-w-2xl text-base leading-relaxed text-muted-foreground">
				{guide.scope}
			</p>
		</header>
	);
}

/**
 * 左侧目录定路由，header 由目录数据渲染；正文按章节懒加载，未知或未登记路径走 404。
 * 双栏与页内目录由 GuideTocLayout 统一承载。
 */
export function LibraryGuidePage({ slug }: { slug: string }) {
	const guide = DESIGN_SYSTEM_CATALOG.flatMap((group) => group.items).find(
		(item) => item.id === slug && item.to === `/design-system/guides/${slug}`,
	);
	const group = guide && DESIGN_SYSTEM_CATALOG.find((item) => item.items.includes(guide));
	const Content = GUIDE_CONTENT[slug as keyof typeof GUIDE_CONTENT];
	if (!group || !guide || !Content) throw notFound();

	return (
		<article className="pb-24 font-sans">
			<GuideTocLayout>
				<div className="space-y-10">
					<GuideHeader group={group.title} guide={guide} />
					<Suspense fallback={<GuideFallback />}>
						<Content />
					</Suspense>
				</div>
			</GuideTocLayout>
		</article>
	);
}

import { notFound } from "@tanstack/react-router";
import { Suspense, useCallback, useState } from "react";
import { DESIGN_SYSTEM_CATALOG } from "../model/guides";
import { GuideTocProvider, type GuideTocRegistration, LibraryGuideToc } from "./LibraryGuideToc";
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
 *
 * Markdown 指南渲染后经 GuideTocContext 上报页内目录，页面切换为
 * 「正文（max-w-4xl）+ 右侧 sticky 目录」双栏；目录栏 xl 以下隐藏。
 * 双栏区域左缘锚定在无目录时 max-w-4xl 居中版心的左缘：目录出现时
 * 版心与页头零位移，可用宽度只向右生长，JSX 指南路径保持原排版。
 */
export function LibraryGuidePage({ slug }: { slug: string }) {
	const [toc, setToc] = useState<GuideTocRegistration | null>(null);
	const registerToc = useCallback((registration: GuideTocRegistration | null) => {
		setToc(registration);
	}, []);

	const guide = DESIGN_SYSTEM_CATALOG.flatMap((group) => group.items).find(
		(item) => item.id === slug && item.to === `/design-system/guides/${slug}`,
	);
	const group = guide && DESIGN_SYSTEM_CATALOG.find((item) => item.items.includes(guide));
	const Content = GUIDE_CONTENT[slug as keyof typeof GUIDE_CONTENT];
	if (!group || !guide || !Content) throw notFound();

	const hasToc = toc !== null && toc.items.length > 0;
	const body = (
		<>
			<GuideHeader group={group.title} guide={guide} />
			<Suspense fallback={<GuideFallback />}>
				<Content />
			</Suspense>
		</>
	);

	return (
		<article className="pb-24 font-sans">
			<GuideTocProvider onRegister={registerToc}>
				<div
					className={
						hasToc
							? // 左缘 = max(0, (容器宽-56rem)/2)（即 mx-auto max-w-4xl 的左缘），
								// 宽 = min(剩余宽度, 56rem 正文 + 2.5rem 间距 + 14rem 目录)
								"ml-[max(0px,calc((100%_-_56rem)/2))] w-[min(calc(100%_-_max(0px,calc((100%_-_56rem)/2))),72.5rem)]"
							: "mx-auto w-full max-w-4xl"
					}
				>
					{toc !== null && toc.items.length > 0 ? (
						<div className="flex gap-10">
							<div className="min-w-0 max-w-4xl flex-1 space-y-10">{body}</div>
							<LibraryGuideToc items={toc.items} bodyRef={toc.bodyRef} />
						</div>
					) : (
						<div className="space-y-10">{body}</div>
					)}
				</div>
			</GuideTocProvider>
		</article>
	);
}

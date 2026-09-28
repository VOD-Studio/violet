import { notFound } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { LIBRARY_GUIDE_GROUPS, LIBRARY_GUIDES } from "../model/guides";
import { AGENT_GUIDES } from "./library-guides/AgentGuides";
import { FOUNDATION_GUIDES } from "./library-guides/FoundationGuides";
import { INTRODUCTION_GUIDES } from "./library-guides/IntroductionGuides";

const GUIDE_CONTENT: Record<string, ReactNode> = {
	...INTRODUCTION_GUIDES,
	...FOUNDATION_GUIDES,
	...AGENT_GUIDES,
};

/** 按文档目录呈现使用说明，未知路径走正常的路由 404。 */
export function LibraryGuidePage({ slug }: { slug: string }) {
	const guide = LIBRARY_GUIDES.find((item) => item.slug === slug);
	const content = GUIDE_CONTENT[slug];
	if (!guide || !content) throw notFound();

	const group = LIBRARY_GUIDE_GROUPS.find((item) => item.items.includes(guide));
	return (
		<article className="mx-auto w-full max-w-4xl space-y-10 pb-24 font-sans">
			<header className="space-y-3 border-b border-border/60 pb-8">
				<p className="font-serif text-sm text-muted-foreground">
					营造法式 / {group?.title}
				</p>
				<h1 className="font-serif text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
					{guide.title}
				</h1>
				<p className="max-w-2xl text-base leading-relaxed text-muted-foreground">
					{guide.scope}
				</p>
			</header>
			{content}
		</article>
	);
}

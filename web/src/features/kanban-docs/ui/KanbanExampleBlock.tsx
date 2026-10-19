import { MarkdownContent } from "@shared/ui/markdown-preview/MarkdownContent";
import { ChevronRight } from "lucide-react";
import type { KanbanExample } from "../model/examples";

/** 一个演示：说明、可操作的预览，以及折叠起来的同一份源码（代码卡自带复制按钮）。 */
export function KanbanExampleBlock({ example }: { example: KanbanExample }) {
	const { id, title, description, Component, source } = example;
	// 加前缀：API 正文的标题也会生成 id（如 ## Canvas → canvas），不能撞上
	const anchor = `example-${id}`;
	return (
		<article id={anchor} aria-labelledby={`${anchor}-title`} className="scroll-mt-24">
			<h3 id={`${anchor}-title`} className="text-lg font-medium tracking-tight">
				{title}
			</h3>
			<p className="mt-1.5 max-w-2xl font-reading text-sm leading-relaxed text-muted-foreground">
				{description}
			</p>
			<div
				data-kanban-example={id}
				className="mt-4 rounded-2xl border border-border/60 bg-muted/30 p-4 font-reading sm:p-6"
			>
				<Component />
			</div>
			<details className="group mt-3">
				<summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded-sm font-mono text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
					<ChevronRight
						className="size-3.5 transition-transform group-open:rotate-90 motion-reduce:transition-none"
						aria-hidden="true"
					/>
					源码 · examples/{id}.tsx
				</summary>
				<MarkdownContent content={`\`\`\`tsx\n${source.trimEnd()}\n\`\`\``} />
			</details>
		</article>
	);
}

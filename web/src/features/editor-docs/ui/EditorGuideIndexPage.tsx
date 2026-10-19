import { Link } from "@tanstack/react-router";
import { PageShell } from "@violet/ui";
import { EDITOR_GUIDE_CHAPTERS } from "../model/chapters";

/** 手册目录页：章节卡片索引。 */
export function EditorGuideIndexPage() {
	return (
		<PageShell className="pt-4 font-sans sm:pt-8">
			<div className="mx-auto w-full max-w-4xl pb-24">
				<header className="space-y-3 border-b border-border/60 pb-8">
					<p className="text-sm text-muted-foreground">作者参考</p>
					<h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
						文章编辑器手册
					</h1>
					<p className="max-w-2xl text-base leading-relaxed text-muted-foreground">
						编辑器为 Tiptap 富文本，保存时双写 content_html（展示权威源）与
						content_md（有损降级源）。每一章都是真实渲染的演示——数学章节渲染的就是真公式，
						图块章节画的就是真手绘图。
					</p>
				</header>
				<ul className="mt-10 grid gap-4 sm:grid-cols-2">
					{EDITOR_GUIDE_CHAPTERS.map((chapter, index) => (
						<li key={chapter.id}>
							<Link
								to="/editor-guide/$chapter"
								params={{ chapter: chapter.id }}
								className="flex h-full flex-col gap-2 rounded-2xl border border-border p-5 motion-safe:transition-colors hover:border-primary/60"
							>
								<span className="text-xs tabular-nums text-muted-foreground">
									{String(index + 1).padStart(2, "0")}
								</span>
								<span className="text-lg font-semibold text-foreground">
									{chapter.title}
								</span>
								<span className="text-sm leading-relaxed text-muted-foreground">
									{chapter.description}
								</span>
							</Link>
						</li>
					))}
				</ul>
			</div>
		</PageShell>
	);
}

import ArticleContent from "@shared/ui/markdown-preview/ArticleContent";
import type { ArticleSection } from "../model/article";
import { ARTICLE } from "../model/article";
import { READING_BASELINE_OFFSET } from "../model/use-active-section";

/** 单节正文 markdown：导语作引用块，段落空行分隔，交生产 ArticleContent 渲染。 */
function sectionMarkdown(section: ArticleSection): string {
	const lead = section.lead ? `> ${section.lead}\n\n` : "";
	return `${lead}${section.paragraphs.join("\n\n")}`;
}

function Section({
	section,
	depth,
	indexStr,
}: {
	section: ArticleSection;
	depth: number;
	indexStr: string;
}) {
	const Heading = depth === 1 ? "h2" : depth === 2 ? "h3" : "h4";

	return (
		// 标题手动渲染而非交给 ArticleContent：锚点 id 是目录契约（ALL_SECTION_IDS），
		// rehype-slug 的标题 slug 化无法产出这些稳定 id；正文排版则完全走生产组件。
		<section
			id={section.id}
			style={{ scrollMarginTop: READING_BASELINE_OFFSET }}
			className="pt-4"
		>
			<div className="mb-3 flex items-baseline gap-2.5">
				{depth === 1 && (
					<span className="font-mono text-xs font-semibold tracking-wider text-muted-foreground/60">
						§ {indexStr}
					</span>
				)}
				<Heading
					className={
						depth === 1
							? "text-2xl font-bold tracking-tight text-foreground md:text-3xl"
							: depth === 2
								? "mt-8 text-xl font-semibold tracking-tight text-foreground md:text-2xl"
								: "mt-6 text-lg font-semibold text-foreground/90"
					}
				>
					{section.title}
				</Heading>
			</div>

			{/* 对齐生产正文页的 prose 容器形态（blog/$slug 同款段落字号与行高走生产样式） */}
			<div className="prose prose-neutral dark:prose-invert max-w-none">
				<ArticleContent content={sectionMarkdown(section)} />
			</div>

			{section.children?.map((child, idx) => (
				<Section
					key={child.id}
					section={child}
					depth={depth + 1}
					indexStr={`${indexStr}.${idx + 1}`}
				/>
			))}
		</section>
	);
}

export function DemoArticle() {
	return (
		<article className="min-w-0 max-w-190 pb-40">
			<header className="mb-12 border-b border-edge-hairline pb-8">
				<div className="mb-4 flex items-center gap-3">
					<span className="rounded-md border border-edge-hairline bg-muted/40 px-2 py-0.5 font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
						Specimen
					</span>
					<span className="font-mono text-[11px] text-muted-foreground/60">
						14 MIN READ · 3 LEVELS OF HIERARCHY
					</span>
				</div>
				<h1 className="mb-4 text-3xl font-bold leading-tight tracking-tight text-foreground md:text-5xl">
					在长文里，目录是一张会呼吸的地图
				</h1>
				<p className="text-base leading-relaxed text-muted-foreground md:text-lg">
					一篇关于层级、方向感与安静导航的固定演示文章。向下阅读，观察左侧目录如何跟随章节流畅交接。
				</p>
			</header>

			<div className="space-y-12">
				{ARTICLE.map((section, idx) => (
					<Section
						key={section.id}
						section={section}
						depth={1}
						indexStr={String(idx + 1).padStart(2, "0")}
					/>
				))}
			</div>
		</article>
	);
}

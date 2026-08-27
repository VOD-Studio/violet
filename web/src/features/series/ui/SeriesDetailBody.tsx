import { BackLink } from "@features/lab/nav/ui/BackLink";
import type { SeriesChapter, SeriesDetail } from "@features/series/model/types";
import { BookCover } from "@features/series/ui/BookCover";
import { Link } from "@tanstack/react-router";
import { BookOpen } from "lucide-react";

function ChapterRow({ chapter }: { chapter: SeriesChapter }) {
	return (
		<li>
			<Link
				to="/blog/$slug"
				params={{ slug: chapter.slug }}
				className="hover:bg-muted/60 flex items-baseline gap-3 rounded-md px-3 py-2.5 transition-colors"
			>
				<span className="text-muted-foreground w-7 shrink-0 font-mono text-xs">
					{String(chapter.chapter_no).padStart(2, "0")}
				</span>
				<span className="min-w-0 flex-1 truncate text-sm">{chapter.title}</span>
			</Link>
		</li>
	);
}

function formatDate(s: string): string {
	if (!s) return "";
	const d = new Date(s);
	return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("zh-CN");
}

/**
 * 书籍详情主体：封面 + 元信息 + 两层目录（根章节在前，各卷按序）。
 * 匿名可浏览；draft 书与非 published 章节已在 API 层过滤。
 */
export function SeriesDetailBody({ detail }: { detail: SeriesDetail }) {
	const firstChapter =
		detail.root_chapters[0] ?? detail.sections.find((s) => s.chapters.length > 0)?.chapters[0];
	const sectionCount = detail.sections.length;

	return (
		<div>
			<BackLink to="/series" label="系列书" className="mb-8" />
			<header className="grid gap-10 md:grid-cols-[220px_minmax(0,1fr)]">
				<div className="mx-auto w-52 md:mx-0 md:w-full">
					<BookCover book={detail} size="lg" className="w-full" subtitle="Online Book" />
				</div>
				<div className="flex flex-col justify-center">
					<p className="text-muted-foreground mb-3 text-sm">
						{sectionCount > 0 ? `${sectionCount} 卷 · ` : ""}
						{detail.chapter_count} 章
						{detail.latest_chapter_at
							? ` · 最近更新 ${formatDate(detail.latest_chapter_at)}`
							: ""}
					</p>
					<h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
						{detail.title}
					</h1>
					{detail.description ? (
						<p className="text-muted-foreground mt-6 max-w-2xl leading-7">
							{detail.description}
						</p>
					) : null}
					{firstChapter ? (
						<div className="mt-8">
							<Link
								to="/blog/$slug"
								params={{ slug: firstChapter.slug }}
								className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm transition-colors"
							>
								<BookOpen className="size-4" />
								从第 {firstChapter.chapter_no} 章开始读
							</Link>
						</div>
					) : (
						<p className="text-muted-foreground mt-8 text-sm">目录还在准备中</p>
					)}
				</div>
			</header>

			{detail.chapter_count > 0 && (
				<section className="mt-16">
					<div className="mb-6 flex items-baseline justify-between border-b border-edge-hairline pb-4">
						<h2 className="text-2xl font-semibold">目录</h2>
						<span className="text-muted-foreground text-sm">
							{sectionCount > 0 ? `${sectionCount} 卷 · ` : ""}
							{detail.chapter_count} 章
						</span>
					</div>
					{detail.root_chapters.length > 0 && (
						<ol className="space-y-0.5">
							{detail.root_chapters.map((c) => (
								<ChapterRow key={c.post_id} chapter={c} />
							))}
						</ol>
					)}
					<div className="space-y-6">
						{detail.sections.map((sec) => (
							<div
								key={sec.section.id}
								className="border-edge-hairline not-first:border-t not-first:pt-6"
							>
								<h3 className="mb-2 px-3 font-semibold">{sec.section.title}</h3>
								{sec.chapters.length > 0 ? (
									<ol className="space-y-0.5">
										{sec.chapters.map((c) => (
											<ChapterRow key={c.post_id} chapter={c} />
										))}
									</ol>
								) : (
									<p className="text-muted-foreground px-3 py-2 text-sm">
										本卷尚无章节
									</p>
								)}
							</div>
						))}
					</div>
				</section>
			)}
		</div>
	);
}

import { usePublishedNote } from "@entities/note/api/queries";
import { useArticleImagePreview } from "@shared/hooks/use-article-image-preview";
import Empty from "@shared/ui/empty";
import { FloatingBack } from "@shared/ui/floating-back";
import ArticleContent from "@shared/ui/markdown-preview/ArticleContent";
import { PageShell } from "@shared/ui/page-shell";
import { ShimmerSkeleton } from "@shared/ui/shimmer-skeleton";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Calendar, CheckCircle2, Copy, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { noteDate, notePlainLength, noteTitle } from "../model/display";

interface NoteDetailPageProps {
	noteId: string;
}

/**
 * 笔记前台详情页 - 独创「技术案卷卡片 / 战地工单报告」设计
 *
 * 彻底消除空旷感与粗暴跨行黑体，将短篇踩坑手记封装为结构严谨的工程档案文件：
 * - 顶部工单元数据标尺（UUID、状态、时间戳、快捷复制）
 * - 精炼醒目的标题编排
 * - 正文结构化呈现
 * - 尾部归档验收章（VERIFIED & ARCHIVED）
 */
export function NoteDetailPage({ noteId }: NoteDetailPageProps) {
	const { data: note, isLoading, isError } = usePublishedNote(noteId);
	const articleImages = useArticleImagePreview();
	const [copied, setCopied] = useState(false);

	const handleCopy = () => {
		if (typeof window !== "undefined") {
			void navigator.clipboard.writeText(window.location.href);
			setCopied(true);
			toast.success("工单访问链接已复制");
			setTimeout(() => setCopied(false), 2000);
		}
	};

	return (
		<PageShell>
			<FloatingBack to="/notes" label="返回工单列表" />

			{isLoading ? (
				<DossierDetailSkeleton />
			) : isError || !note ? (
				<Empty
					title="未检索到该工单档案"
					description="可能已被删除、合并或处于非公开状态"
					className="py-24"
					size="lg"
				/>
			) : (
				<div className="mx-auto max-w-3xl">
					{/* 战地技术档案卡本体 */}
					<article className="border-edge-hairline bg-card/40 relative overflow-hidden rounded-xl border shadow-xl">
						{/* 顶部装配挂钩与打孔装饰线 */}
						<div className="border-edge-hairline bg-muted/30 flex items-center justify-between border-b px-5 py-3 font-mono text-[11px] text-muted-foreground/80">
							<div className="flex items-center gap-2">
								<Link
									to="/notes"
									className="hover:text-foreground inline-flex items-center gap-1 font-semibold text-foreground/80 transition-colors"
								>
									<ArrowLeft className="size-3" />
									<span>NOTES_INDEX</span>
								</Link>
								<span className="text-muted-foreground/40">/</span>
								<span className="text-[10px] text-muted-foreground/60 uppercase">
									CASE-{note.id.slice(0, 8)}
								</span>
							</div>

							<div className="flex items-center gap-3 tabular-nums">
								<span className="flex items-center gap-1 text-emerald-500/90 font-medium">
									<CheckCircle2 className="size-3" />
									RESOLVED
								</span>
								<span className="text-muted-foreground/40">|</span>
								<button
									type="button"
									onClick={handleCopy}
									className="hover:text-foreground inline-flex items-center gap-1 text-muted-foreground transition-colors"
									title="复制此工单直达链接"
								>
									<Copy className="size-3" />
									<span>{copied ? "COPIED" : "SHARE"}</span>
								</button>
							</div>
						</div>

						{/* 工单主体内容区 */}
						<div className="p-6 sm:p-8 md:p-10">
							{/* 工单头部信息 */}
							<header className="space-y-4 border-b border-edge-hairline pb-6">
								{/* 标签标尺 */}
								<div className="flex flex-wrap items-center gap-1.5 font-mono text-xs">
									<span className="text-muted-foreground/50 text-[10px] uppercase">
										TAGS:
									</span>
									{note.tags.length > 0 ? (
										note.tags.map((t) => (
											<Link key={t} to="/notes" search={{ tag: t }}>
												<span className="border-edge-hairline bg-muted/40 hover:border-foreground/30 hover:bg-muted/80 inline-block rounded px-2 py-0.5 text-[11px] text-muted-foreground transition-colors">
													#{t}
												</span>
											</Link>
										))
									) : (
										<span className="text-[11px] text-muted-foreground/50">
											#general
										</span>
									)}
								</div>

								{/* 标题 */}
								<h1 className="text-xl font-bold leading-snug tracking-tight text-foreground sm:text-2xl font-mono">
									{noteTitle(note)}
								</h1>

								{/* 元数据参数栏 */}
								<div className="flex flex-wrap items-center justify-between gap-y-2 pt-1 font-mono text-[11px] text-muted-foreground/70">
									<div className="flex items-center gap-3 tabular-nums">
										<span className="flex items-center gap-1">
											<Calendar className="size-3" />
											{noteDate(note.published_at)}
										</span>
										<span>•</span>
										<span>{notePlainLength(note.content_html)} CHARS</span>
										<span>•</span>
										<span>
											EST.{" "}
											{Math.max(
												1,
												Math.ceil(notePlainLength(note.content_html) / 400),
											)}{" "}
											MIN
										</span>
									</div>

									<div className="text-[10px] text-muted-foreground/50 uppercase">
										ORIGIN: PRODUCTION_LOG
									</div>
								</div>
							</header>

							{/* 正文呈现 */}
							<div
								className="prose prose-neutral dark:prose-invert max-w-none pt-6 leading-relaxed font-sans prose-pre:rounded-lg prose-pre:border prose-pre:border-edge-hairline"
								data-article-content
								onClick={articleImages.bind.onClick}
								onKeyDown={articleImages.bind.onKeyDown}
							>
								<ArticleContent content={note.content_html} />
							</div>

							{/* 尾部验收签名章 */}
							<footer className="mt-10 border-t border-edge-hairline pt-6">
								<div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
									<div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
										<ShieldCheck className="size-4 text-emerald-500" />
										<span>VERIFIED_POSTMORTEM_ENTRY</span>
									</div>

									<Link
										to="/notes"
										className="group inline-flex items-center gap-1 font-mono text-xs text-primary transition-colors hover:underline"
									>
										<span>INDEX_OVERVIEW</span>
										<ArrowLeft className="size-3 rotate-180 transition-transform group-hover:translate-x-1" />
									</Link>
								</div>
							</footer>
						</div>
					</article>
				</div>
			)}
		</PageShell>
	);
}

function DossierDetailSkeleton() {
	return (
		<div className="mx-auto max-w-3xl">
			<div className="border-edge-hairline bg-card/20 rounded-xl border p-6 sm:p-10 space-y-6">
				<div className="flex justify-between border-b border-edge-hairline pb-4">
					<ShimmerSkeleton className="h-3 w-28" />
					<ShimmerSkeleton className="h-3 w-20" />
				</div>
				<ShimmerSkeleton className="h-4 w-36" />
				<ShimmerSkeleton className="h-7 w-4/5" />
				<div className="flex justify-between border-b border-edge-hairline pb-4">
					<ShimmerSkeleton className="h-3 w-40" />
					<ShimmerSkeleton className="h-3 w-24" />
				</div>
				<div className="space-y-3 pt-4">
					<ShimmerSkeleton className="h-4 w-full" />
					<ShimmerSkeleton className="h-4 w-11/12" />
					<ShimmerSkeleton className="h-4 w-4/5" />
					<ShimmerSkeleton className="h-4 w-full" />
					<ShimmerSkeleton className="h-4 w-2/3" />
				</div>
			</div>
		</div>
	);
}

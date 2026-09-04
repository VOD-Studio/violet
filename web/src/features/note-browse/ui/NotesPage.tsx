import { usePublishedNotesFeed } from "@entities/note/api/queries";
import type { PublicNote } from "@entities/note/model/types";
import { Button } from "@shared/ui/base/button";
import Empty from "@shared/ui/empty";
import { PageShell } from "@shared/ui/page-shell";
import { ShimmerSkeleton } from "@shared/ui/shimmer-skeleton";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Calendar, Filter, Loader2 } from "lucide-react";
import { useMemo } from "react";
import { noteDate, noteExcerpt, notePlainLength, noteTitle } from "../model/display";

export const NOTES_PAGE_LIMIT = 24;

interface NotesPageProps {
	tag?: string;
}

/**
 * 笔记前台列表 - 独创「工程战地工单 / 活页档案」设计体系 (The Field Dossier)
 */
export function NotesPage({ tag }: NotesPageProps) {
	const feed = usePublishedNotesFeed(NOTES_PAGE_LIMIT, tag);
	const tagPool = useMemo(() => {
		const seen = new Set<string>();
		for (const note of feed.notes) {
			for (const t of note.tags) seen.add(t);
		}
		return [...seen];
	}, [feed.notes]);

	if (feed.isError) {
		return (
			<PageShell>
				<DossierHeader activeTag={tag} totalNotes={0} />
				<Empty
					title="档案读取失败"
					description="网络或数据端点暂时不可用"
					action={
						<Button variant="outline" onClick={() => void feed.refetch()}>
							重新连接
						</Button>
					}
					className="py-24"
					size="lg"
				/>
			</PageShell>
		);
	}

	return (
		<PageShell>
			{/* 独创战地档案页头 */}
			<DossierHeader activeTag={tag} totalNotes={feed.notes.length} />

			{/* 领域过滤导轨 */}
			{tagPool.length > 0 && <DossierFilterBar tags={tagPool} active={tag} />}

			{feed.isLoading ? (
				<DossierGridSkeleton />
			) : feed.notes.length === 0 ? (
				<Empty
					title={tag ? `没有 ${tag} 的笔记` : "暂无笔记"}
					description={tag ? "换个标签看看" : "踩过的坑会在这里沉淀"}
					className="py-24"
					size="lg"
				/>
			) : (
				<>
					{/* 活页工单双列矩阵 */}
					<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
						{feed.notes.map((note, index) => (
							<FieldNoteTicket key={note.id} note={note} index={index} />
						))}
					</div>

					{feed.hasMore && (
						<div className="mt-12 flex justify-center pb-6">
							<Button
								variant="outline"
								disabled={feed.loadingMore}
								onClick={feed.loadMore}
								className="h-9 rounded-md border-dashed px-6 font-mono text-xs tracking-wider uppercase"
							>
								{feed.loadingMore ? (
									<Loader2 className="mr-2 size-3.5 animate-spin" />
								) : null}
								{feed.loadMoreFailed ? "重新加载下页" : "读取更多档案记录 >>"}
							</Button>
						</div>
					)}
				</>
			)}
		</PageShell>
	);
}

/** 独创档案柜页头：工程打孔标头与实时指标 */
function DossierHeader({ activeTag, totalNotes }: { activeTag?: string; totalNotes: number }) {
	return (
		<header className="border-edge-hairline relative mb-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/30 to-muted/10 p-6 sm:p-8">
			{/* 顶部微观装配标尺 */}
			<div className="flex items-center justify-between border-b border-edge-hairline pb-4 font-mono text-[11px] text-muted-foreground/70">
				<div className="flex items-center gap-2">
					<span className="flex size-2 rounded-full bg-emerald-500/80 animate-pulse" />
					<span className="font-semibold tracking-wider text-foreground uppercase">
						ENGINEERING FIELD LOGS
					</span>
					<span className="text-muted-foreground/40">{"//"}</span>
					<span>SYS.NOTES.V2</span>
				</div>
				<div className="flex items-center gap-3 tabular-nums">
					<span>STATUS: INDEXED</span>
					<span className="text-muted-foreground/40">|</span>
					<span>ENTRIES: {totalNotes}</span>
				</div>
			</div>

			{/* 主标题与导语 */}
			<div className="mt-6 flex flex-col justify-between gap-4 md:flex-row md:items-end">
				<div>
					<h1 className="text-3xl font-black tracking-tight text-foreground sm:text-4xl font-mono">
						FIELD_NOTES<span className="text-primary">.</span>
					</h1>
					<p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
						实战踩坑手记、根因断定与解决方案速查。记录一次，永久复用。
					</p>
				</div>

				{activeTag && (
					<div className="border-edge-hairline flex items-center gap-2 rounded-lg border bg-background/80 px-3 py-1.5 font-mono text-xs shadow-2xs backdrop-blur-xs">
						<span className="text-muted-foreground">按标签筛选：</span>
						<span className="font-semibold text-primary">{activeTag}</span>
						<Link
							to="/notes"
							className="text-muted-foreground/60 hover:text-foreground ml-1 text-xs"
							title="清除标签过滤"
						>
							&times;
						</Link>
					</div>
				)}
			</div>
		</header>
	);
}

/** 领域标签过滤导轨：打字机打孔键式排布 */
function DossierFilterBar({ tags, active }: { tags: string[]; active?: string }) {
	return (
		<div className="mb-6 flex flex-wrap items-center gap-1.5 font-mono text-xs">
			<span className="text-muted-foreground/60 mr-2 inline-flex items-center gap-1 text-[11px] uppercase tracking-wider">
				<Filter className="size-3" />
				SCOPE:
			</span>
			<Link
				to="/notes"
				className={`rounded-md border px-2.5 py-1 transition-colors ${
					!active
						? "border-primary/50 bg-primary/10 font-medium text-primary shadow-2xs"
						: "border-edge-hairline bg-muted/20 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
				}`}
			>
				ALL_ENTRIES
			</Link>
			{tags.map((t) => {
				const isCur = t === active;
				return (
					<Link
						key={t}
						to="/notes"
						search={{ tag: t }}
						className={`rounded-md border px-2.5 py-1 transition-colors ${
							isCur
								? "border-primary/50 bg-primary/10 font-medium text-primary shadow-2xs"
								: "border-edge-hairline bg-muted/20 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
						}`}
					>
						#{t}
					</Link>
				);
			})}
		</div>
	);
}

/**
 * 战地工单卡片 (Field Note Ticket)：
 * 左侧刻度引线 + 顶部案卷元数据 + 标题结构 + 底部快照
 */
function FieldNoteTicket({ note, index }: { note: PublicNote; index: number }) {
	const wordCount = notePlainLength(note.content_html);
	const snippet = noteExcerpt(note.content_html, 100);
	const displayTitle = noteTitle(note);

	return (
		<Link
			to="/notes/$id"
			params={{ id: note.id }}
			className="group relative flex flex-col justify-between overflow-hidden rounded-xl border border-edge-hairline bg-card/40 p-5 transition-all duration-200 hover:border-foreground/30 hover:bg-muted/30 hover:shadow-lg focus:outline-none"
		>
			{/* 顶部左上悬浮装饰角标 */}
			<div className="absolute top-0 right-0 h-10 w-10 overflow-hidden">
				<div className="absolute top-[-20px] right-[-20px] size-10 rotate-45 bg-edge-hairline transition-colors group-hover:bg-primary/30" />
			</div>
			<div>
				{/* 工单顶栏：编号 + 日期 + 格式标识 */}
				<div className="flex items-center justify-between border-b border-edge-hairline pb-3 font-mono text-[11px] text-muted-foreground">
					<div className="flex items-center gap-2">
						<span className="font-semibold text-foreground/90 tabular-nums">
							{String(index + 1).padStart(2, "0")}
						</span>
						<span className="text-muted-foreground/40">/</span>
						<span className="text-[10px] text-muted-foreground/70 uppercase">
							CASE-{note.id.slice(0, 8)}
						</span>
					</div>
					<div className="flex items-center gap-1.5 tabular-nums text-muted-foreground/80">
						<Calendar className="size-3 text-muted-foreground/60" />
						{noteDate(note.published_at)}
					</div>
				</div>

				{/* 标题 */}
				<div className="mt-3.5 space-y-2">
					<h2 className="text-base font-bold leading-snug tracking-tight text-foreground transition-colors group-hover:text-primary">
						{displayTitle}
					</h2>

					{/* 纯文本内容快照：仅在有标题时渲染，无标题笔记标题已是正文开头，避免复读 */}
					{note.title && snippet && (
						<p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground/80">
							{snippet}
						</p>
					)}
				</div>
			</div>

			{/* 底部技术元信息与进入跃迁 */}
			<div className="mt-5 flex items-center justify-between border-t border-edge-hairline pt-3 text-xs">
				<div className="flex flex-wrap items-center gap-1.5">
					{note.tags.length > 0 ? (
						note.tags.map((t) => (
							<span
								key={t}
								className="border-edge-hairline bg-muted/40 rounded px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground group-hover:border-foreground/20 group-hover:text-foreground"
							>
								#{t}
							</span>
						))
					) : (
						<span className="font-mono text-[10px] text-muted-foreground/50">
							#snippet
						</span>
					)}
				</div>

				<div className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground/70">
					<span>{wordCount} W</span>
					<ArrowRight className="size-3.5 transition-transform duration-200 group-hover:translate-x-1 group-hover:text-foreground" />
				</div>
			</div>
		</Link>
	);
}

function DossierGridSkeleton() {
	return (
		<div aria-hidden className="grid grid-cols-1 gap-4 lg:grid-cols-2">
			{Array.from({ length: 4 }, (_, i) => (
				<div
					key={i}
					className="border-edge-hairline bg-card/20 flex h-40 flex-col justify-between rounded-xl border p-5"
				>
					<div className="flex justify-between border-b border-edge-hairline pb-3">
						<ShimmerSkeleton className="h-3 w-16" />
						<ShimmerSkeleton className="h-3 w-20" />
					</div>
					<div className="space-y-2 py-2">
						<ShimmerSkeleton className="h-4 w-3/4" />
						<ShimmerSkeleton className="h-3 w-full" />
					</div>
					<div className="flex justify-between border-t border-edge-hairline pt-3">
						<ShimmerSkeleton className="h-3.5 w-24" />
						<ShimmerSkeleton className="h-3 w-12" />
					</div>
				</div>
			))}
		</div>
	);
}

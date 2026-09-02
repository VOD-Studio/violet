import { usePublishedNotesFeed } from "@entities/note/api/queries";
import type { PublicNote } from "@entities/note/model/types";
import { cn } from "@shared/lib/utils";
import { Button } from "@shared/ui/base/button";
import Empty from "@shared/ui/empty";
import { PageShell } from "@shared/ui/page-shell";
import { ShimmerSkeleton } from "@shared/ui/shimmer-skeleton";
import { Link } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useMemo } from "react";
import { noteDate, noteTitle } from "../model/display";

export const NOTES_PAGE_LIMIT = 20;

interface NotesPageProps {
	/** 当前生效的标签筛选（slug）。 */
	tag?: string;
}

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
				<PageHeader tag={tag} />
				<Empty
					title="笔记加载失败"
					description="网络或服务暂时不可用"
					action={
						<Button variant="outline" onClick={() => void feed.refetch()}>
							重试
						</Button>
					}
					className="py-20"
					size="lg"
				/>
			</PageShell>
		);
	}

	return (
		<PageShell>
			<PageHeader tag={tag} />
			{tagPool.length > 0 ? <TagFilter tags={tagPool} active={tag} /> : null}

			{feed.isLoading ? (
				<NotesSkeleton />
			) : feed.notes.length === 0 ? (
				<Empty
					title={tag ? `没有 ${tag} 的笔记` : "暂无笔记"}
					description={tag ? "换个标签看看" : "踩过的坑会在这里沉淀"}
					className="py-20"
					size="lg"
				/>
			) : (
				<>
					<NotesIndex notes={feed.notes} />
					{feed.hasMore ? (
						<div className="mt-14 flex justify-center">
							<div className="space-y-3 text-center">
								{feed.loadMoreFailed ? (
									<p role="alert" className="text-destructive text-sm">
										加载下一页失败，请重试
									</p>
								) : null}
								<Button
									variant="outline"
									disabled={feed.loadingMore}
									onClick={feed.loadMore}
								>
									{feed.loadingMore ? (
										<Loader2 className="size-4 animate-spin" />
									) : null}
									{feed.loadMoreFailed ? "重试加载" : "加载更多"}
								</Button>
							</div>
						</div>
					) : null}
				</>
			)}
		</PageShell>
	);
}

function PageHeader({ tag }: { tag?: string }) {
	return (
		<header className="mb-12 max-w-2xl space-y-3">
			<p className="font-mono text-muted-foreground text-xs tracking-[0.3em] uppercase">
				Field Notes
			</p>
			<h1 className="font-mono font-bold text-4xl">笔记</h1>
			<p className="text-muted-foreground leading-relaxed">
				踩过的坑、根因与修法，一条一个知识点。
			</p>
			{tag ? (
				<p className="font-mono text-muted-foreground/70 text-sm">
					按标签筛选：<span className="text-foreground">{tag}</span>
				</p>
			) : null}
		</header>
	);
}

function TagFilter({ tags, active }: { tags: string[]; active?: string }) {
	return (
		<nav aria-label="标签筛选" className="mb-10 flex flex-wrap gap-x-4 gap-y-2">
			{active ? (
				<TagLink to="/notes" label="全部" />
			) : (
				<span className="font-mono text-xs text-foreground">全部</span>
			)}
			{tags.map((t) =>
				t === active ? (
					<span key={t} className="font-mono text-xs text-foreground">
						{t}
					</span>
				) : (
					<TagLink key={t} to="/notes" search={{ tag: t }} label={t} />
				),
			)}
		</nav>
	);
}

function TagLink({ to, search, label }: { to: "/notes"; search?: { tag: string }; label: string }) {
	return (
		<Link
			to={to}
			search={search}
			className="font-mono text-muted-foreground/70 text-xs transition-colors hover:text-foreground"
		>
			{label}
		</Link>
	);
}

function NotesSkeleton() {
	return (
		<div>
			<div className="mb-2.5 h-4 w-40" />
			{Array.from({ length: 6 }, (_, i) => (
				<div
					key={i}
					className="flex items-center gap-5 border-b border-edge-hairline py-3.5"
				>
					<ShimmerSkeleton className="size-5" />
					<ShimmerSkeleton className="h-4 flex-1" />
					<ShimmerSkeleton className="h-4 w-20" />
				</div>
			))}
		</div>
	);
}

/** 目录式笔记索引：栏头 + hairline 行 + 序号，层级靠字号与字重（同站内编辑索引语言）。 */
function NotesIndex({ notes }: { notes: PublicNote[] }) {
	return (
		<div>
			<div className="flex items-center justify-between border-b border-edge-hairline pb-2.5 font-mono text-[10px] tracking-[0.3em] text-muted-foreground/50 uppercase">
				<span>Notes · {notes.length}</span>
				<span>date</span>
			</div>
			<div>
				{notes.map((note, i) => (
					<NoteRow key={note.id} note={note} i={i} />
				))}
			</div>
		</div>
	);
}

function NoteRow({ note, i }: { note: PublicNote; i: number }) {
	return (
		<Link
			to="/notes/$id"
			params={{ id: note.id }}
			className="group block border-b border-edge-hairline last:border-b-0"
		>
			<div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-baseline gap-x-5 px-2 py-3.5 transition-colors group-hover:bg-muted/30">
				<span className="font-mono text-sm tabular-nums text-muted-foreground/40 transition-colors group-hover:text-muted-foreground/80">
					{String(i + 1).padStart(2, "0")}
				</span>
				<span className="min-w-0">
					<span
						className={cn(
							"text-foreground",
							note.title
								? "text-base font-medium group-hover:underline group-hover:underline-offset-4"
								: "text-sm text-foreground/85 group-hover:underline group-hover:underline-offset-4",
						)}
					>
						{noteTitle(note)}
					</span>
					{note.tags.length > 0 ? (
						<span className="mt-0.5 block font-mono text-[11px] text-muted-foreground/60">
							{note.tags.join(" / ")}
						</span>
					) : null}
				</span>
				<span className="shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground/60">
					{noteDate(note.published_at)}
				</span>
			</div>
		</Link>
	);
}

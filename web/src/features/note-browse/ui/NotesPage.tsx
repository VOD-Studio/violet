import { usePublishedNotesFeed } from "@entities/note/api/queries";
import type { PublicNote } from "@entities/note/model/types";
import { Button } from "@shared/ui/base/button";
import Empty from "@shared/ui/empty";
import { PageShell } from "@shared/ui/page-shell";
import { ShimmerSkeleton } from "@shared/ui/shimmer-skeleton";
import { Link } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useMemo } from "react";
import { noteDate, noteExcerpt, noteMonthKey, noteMonthLabel, noteTitle } from "../model/display";

export const NOTES_PAGE_LIMIT = 20;

/** 列表摘要行截断长度：一行放下，超出省略。 */
const SUMMARY_MAX = 90;

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
					) : (
						<IndexColophon />
					)}
				</>
			)}
		</PageShell>
	);
}

function PageHeader({ tag }: { tag?: string }) {
	return (
		<header className="mb-14 max-w-2xl space-y-4">
			<p className="font-mono text-muted-foreground text-xs tracking-[0.3em] uppercase">
				Field Notes
			</p>
			<h1 className="text-5xl font-bold tracking-tight md:text-6xl">笔记</h1>
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
		<nav
			aria-label="标签筛选"
			className="mb-8 flex flex-wrap gap-x-5 gap-y-2 border-y border-edge-hairline py-3"
		>
			<FilterLink to="/notes" label="全部" active={!active} />
			{tags.map((t) => (
				<FilterLink
					key={t}
					to="/notes"
					search={{ tag: t }}
					label={t}
					active={t === active}
				/>
			))}
		</nav>
	);
}

function FilterLink({
	to,
	search,
	label,
	active,
}: {
	to: "/notes";
	search?: { tag: string };
	label: string;
	active: boolean;
}) {
	if (active) {
		return (
			<span aria-current="true" className="font-mono text-xs text-foreground">
				{label}
			</span>
		);
	}
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
		<div aria-hidden>
			{Array.from({ length: 5 }, (_, i) => (
				<div key={i} className="border-b border-edge-hairline py-4">
					<div className="grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-baseline gap-x-5 px-2">
						<ShimmerSkeleton className="size-5" />
						<div className="space-y-2">
							<ShimmerSkeleton className="h-4 w-3/5" />
							<ShimmerSkeleton className="h-3 w-4/5" />
						</div>
						<ShimmerSkeleton className="h-3.5 w-20" />
					</div>
				</div>
			))}
		</div>
	);
}

/** 索引收尾块：填补尾屏空洞，给归档一个「合上档案柜」的终止感。 */
function IndexColophon() {
	return (
		<footer className="mt-24 flex flex-col items-center gap-3 pb-6 text-center">
			<span
				aria-hidden
				className="font-mono text-[10px] tracking-[0.4em] text-muted-foreground/40 uppercase"
			>
				Fin
			</span>
			<p className="text-muted-foreground/70 text-sm">坑还会继续踩，笔记持续归档。</p>
		</footer>
	);
}

interface NoteGroup {
	label: string;
	notes: PublicNote[];
	/** 组内首条的全局序号，保证跨组连续编号。 */
	start: number;
}

/** 目录式笔记索引：按月分组 + hairline 行 + 连续序号，层级靠字号与字重（同站内编辑索引语言）。 */
function NotesIndex({ notes }: { notes: PublicNote[] }) {
	const groups = useMemo<NoteGroup[]>(() => {
		const result: NoteGroup[] = [];
		let cursor = 0;
		for (const note of notes) {
			const label = noteMonthLabel(noteMonthKey(note.published_at));
			const last = result.at(-1);
			if (last?.label === label) {
				last.notes.push(note);
			} else {
				result.push({ label, notes: [note], start: cursor });
			}
			cursor += 1;
		}
		return result;
	}, [notes]);

	return (
		<div>
			{groups.map((group) => (
				<section key={group.label}>
					<div className="flex items-baseline justify-between border-b border-edge-hairline pb-2 font-mono text-[10px] tracking-[0.3em] text-muted-foreground/50 uppercase">
						<span>{group.label}</span>
						<span>
							{group.notes.length} {group.notes.length > 1 ? "notes" : "note"}
						</span>
					</div>
					{group.notes.map((note, i) => (
						<NoteRow key={note.id} note={note} index={group.start + i} />
					))}
				</section>
			))}
		</div>
	);
}

function NoteRow({ note, index }: { note: PublicNote; index: number }) {
	return (
		<Link
			to="/notes/$id"
			params={{ id: note.id }}
			className="group block border-b border-edge-hairline last:border-b-0"
		>
			<div className="grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-baseline gap-x-5 px-2 py-4 transition-colors group-hover:bg-muted/30">
				<span className="font-mono text-sm tabular-nums text-muted-foreground/40 transition-colors group-hover:text-muted-foreground/80">
					{String(index + 1).padStart(2, "0")}
				</span>
				<span className="min-w-0">
					<span className="text-foreground group-hover:underline group-hover:underline-offset-4 text-base font-medium">
						{noteTitle(note)}
					</span>
					{note.title ? (
						<span className="text-muted-foreground/80 mt-1 block truncate text-sm">
							{noteExcerpt(note.content_html, SUMMARY_MAX)}
						</span>
					) : null}
					{note.tags.length > 0 ? (
						<span className="text-muted-foreground/60 mt-1.5 block font-mono text-[11px]">
							{note.tags.join(" / ")}
						</span>
					) : null}
				</span>
				<span className="text-muted-foreground/60 shrink-0 font-mono text-[10px] tabular-nums">
					{noteDate(note.published_at)}
				</span>
			</div>
		</Link>
	);
}

import { usePublishedNotesFeed } from "@entities/note/api/queries";
import { NOTE_TYPE_LABELS, type NoteType, type PublicNote } from "@entities/note/model/types";
import { useProjects } from "@entities/project/api/queries";
import type { Tag } from "@entities/tag/model/types";
import { useTags } from "@features/tags/api/queries";
import { formatDate } from "@shared/lib/date";
import { Link } from "@tanstack/react-router";
import {
	Button,
	Card,
	Empty,
	PageShell,
	Segmented,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	Skeleton,
} from "@violet/ui";
import { cn } from "cn";
import {
	groupJournalDays,
	JOURNAL_TIME_ZONE,
	NOTES_PAGE_LIMIT,
	notePreview,
} from "../model/display";
import type { JournalSearch } from "../model/navigation";
import { NoteBadges, NotePitfallContent, NoteTags } from "./NoteJournalMeta";

const ALL = "all";
const TYPE_SEGMENTS = [
	{ value: ALL, label: "全部" },
	{ value: "pitfall", label: NOTE_TYPE_LABELS.pitfall },
	{ value: "idea", label: NOTE_TYPE_LABELS.idea },
	{ value: "excerpt", label: NOTE_TYPE_LABELS.excerpt },
] satisfies { value: NoteType | typeof ALL; label: string }[];
const WEEKDAY = new Intl.DateTimeFormat("zh-CN", {
	timeZone: JOURNAL_TIME_ZONE,
	weekday: "short",
});

/** 手记列表从地址栏读取筛选，并将控件变更交给路由。 */
export interface NotesPageProps {
	search: JournalSearch;
	onSearchChange: (next: JournalSearch) => void;
}

/** 按日期浏览已发布的手写手记。 */
export function NotesPage({ search, onSearchChange }: NotesPageProps) {
	const feed = usePublishedNotesFeed({ ...search, limit: NOTES_PAGE_LIMIT });
	const { data: projects, isLoading: projectsLoading, isError: projectsError } = useProjects();
	const { data: tags } = useTags();
	const tagName = tags?.find((tag) => tag.slug === search.tag)?.name ?? search.tag;
	const hasFilters = Boolean(search.tag || search.type || search.project_id);
	const unmatchedProjectId = projects?.some((project) => project.id === search.project_id)
		? undefined
		: search.project_id;

	return (
		<PageShell className="lg:pt-16.5">
			<div className="mx-auto max-w-280">
				<header className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-end">
					<h1 className="font-serif text-4xl leading-[1.1] tracking-tight md:text-[3.25rem]">
						手记
					</h1>
					<div className="flex max-w-full flex-wrap items-center gap-2.5">
						<Segmented<NoteType | typeof ALL>
							aria-label="按手记类型筛选"
							rounded="full"
							size="default"
							segments={TYPE_SEGMENTS}
							value={search.type ?? ALL}
							onValueChange={(type) =>
								onSearchChange({
									...search,
									type: type === ALL ? undefined : type,
								})
							}
						/>
						<Select
							value={search.project_id ?? ALL}
							onValueChange={(id) =>
								onSearchChange({
									...search,
									project_id: id === ALL ? undefined : id,
								})
							}
						>
							<SelectTrigger
								aria-label="按项目筛选"
								className="w-40"
								loading={projectsLoading}
							>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value={ALL}>全部项目</SelectItem>
								{unmatchedProjectId && (
									<SelectItem value={unmatchedProjectId} disabled>
										{projects ? "未知项目" : "所选项目"}
									</SelectItem>
								)}
								{projects?.map((project) => (
									<SelectItem key={project.id} value={project.id}>
										{project.title}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				</header>
				{projectsError && (
					<p className="mt-3 text-sm text-muted-foreground">项目列表加载失败。</p>
				)}
				{(tagName || search.type === "unclassified") && (
					<div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
						{tagName && (
							<div className="flex min-w-0 flex-wrap items-center gap-2">
								<span className="wrap-anywhere">按标签筛选：{tagName}</span>
								<Button asChild size="sm" variant="ghost">
									<Link to="/journal" search={{ ...search, tag: undefined }}>
										清除标签筛选
									</Link>
								</Button>
							</div>
						)}
						{search.type === "unclassified" && (
							<div className="flex flex-wrap items-center gap-2">
								<span>按类型筛选：{NOTE_TYPE_LABELS.unclassified}</span>
								<Button asChild size="sm" variant="ghost">
									<Link to="/journal" search={{ ...search, type: undefined }}>
										清除类型筛选
									</Link>
								</Button>
							</div>
						)}
					</div>
				)}

				<div aria-busy={feed.isLoading || feed.loadingMore} className="mt-10">
					{feed.isLoading ? (
						<div className="space-y-3.5 ps-8 md:ps-37">
							<Skeleton className="h-24 rounded-xl" />
							<Skeleton className="h-32 rounded-xl" />
						</div>
					) : feed.isError ? (
						<Empty
							title="手记加载失败"
							description="暂时无法读取手记，请重试。"
							action={<Button onClick={() => void feed.refetch()}>重试</Button>}
							className="py-20"
						/>
					) : feed.notes.length === 0 && !feed.hasMore ? (
						<Empty
							title={hasFilters ? "没有符合筛选条件的手记" : "暂无手记"}
							description={
								hasFilters ? "试试清除或更换筛选条件。" : "新的手记会在这里发布。"
							}
							className="py-20"
						/>
					) : (
						<>
							<JournalTimeline
								notes={feed.notes}
								catalog={tags ?? []}
								search={search}
							/>
							{feed.hasMore && (
								<div className="mt-10 text-center">
									{feed.loadMoreFailed && (
										<p
											role="status"
											className="mb-2 text-sm text-muted-foreground"
										>
											下一页加载失败，已保留当前手记。
										</p>
									)}
									<Button
										variant="outline"
										loading={feed.loadingMore}
										onClick={feed.loadMore}
									>
										{feed.loadMoreFailed ? "重试加载更多" : "加载更多"}
									</Button>
								</div>
							)}
						</>
					)}
				</div>
			</div>
		</PageShell>
	);
}

function JournalTimeline({
	notes,
	catalog,
	search,
}: {
	notes: PublicNote[];
	catalog: Tag[];
	search: JournalSearch;
}) {
	const days = groupJournalDays(notes);
	return days.map(([day, dayNotes], dayIndex) => (
		<section
			key={day}
			className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-x-2 md:grid-cols-[5.75rem_1.5rem_minmax(0,1fr)] md:gap-x-4"
		>
			<DateHeading day={day} first={dayIndex === 0} />
			<div className="col-span-2 min-w-0 md:col-start-2 md:row-start-1">
				{dayNotes.map((note, index) => {
					const first = dayIndex === 0 && index === 0;
					const dayEnd = index === dayNotes.length - 1;
					const last = dayEnd && dayIndex === days.length - 1;
					return (
						<div
							className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-x-2 md:gap-x-4"
							key={note.id}
						>
							<div
								aria-hidden="true"
								className={cn(
									"relative before:absolute before:inset-y-0 before:inset-s-1/2 before:w-px before:-translate-x-1/2 before:bg-border",
									first && "before:top-[29px]",
									last && "before:bottom-auto before:h-[29px]",
									first && last && "before:hidden",
								)}
							>
								<span
									className={cn(
										"absolute inset-s-1/2 top-5.5 size-3.5 -translate-x-1/2 rounded-full border-3 border-background",
										note.type === "pitfall"
											? "bg-destructive"
											: "bg-decoration",
									)}
								/>
							</div>
							<div
								className={cn(
									"min-w-0",
									!last && (dayEnd ? "pb-5 md:pb-11" : "pb-3.5"),
								)}
							>
								<JournalCard note={note} catalog={catalog} search={search} />
							</div>
						</div>
					);
				})}
			</div>
		</section>
	));
}

function DateHeading({ day, first }: { day: string; first: boolean }) {
	const [, month, date] = day.split("-");
	const fullDate = formatDate(day, "long-date");
	return (
		<>
			{!first && (
				<div
					aria-hidden="true"
					className="col-start-1 row-start-1 mx-auto w-px bg-border md:hidden"
				/>
			)}
			<h2 className="col-start-2 row-start-1 pb-3 md:col-start-1 md:pt-4">
				{date ? (
					<time
						dateTime={day}
						title={fullDate}
						className="flex items-baseline gap-2 md:block"
					>
						<span className="sr-only">{fullDate}</span>
						<span
							aria-hidden="true"
							className="font-mono text-2xl leading-none font-medium tracking-tight tabular-nums md:text-3xl"
						>
							{date}
						</span>
						<span
							aria-hidden="true"
							className="text-xs text-muted-foreground md:mt-1.5 md:block"
						>
							{Number(month)} 月 · {WEEKDAY.format(new Date(day))}
						</span>
					</time>
				) : (
					<span className="text-sm text-muted-foreground">日期未知</span>
				)}
			</h2>
		</>
	);
}

function JournalCard({
	note,
	catalog,
	search,
}: {
	note: PublicNote;
	catalog: Tag[];
	search: JournalSearch;
}) {
	const { title, excerpt } = notePreview(note);
	const pitfall = note.pitfall;
	const hasPitfallContent =
		pitfall &&
		(pitfall.symptom.trim() ||
			pitfall.cause.trim() ||
			pitfall.remedy.trim() ||
			pitfall.code.trim());
	return (
		<article>
			<Card className="gap-2.5 px-4 py-4.5 font-serif sm:px-5.5">
				<div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
					<NoteBadges note={note} />
					<NoteTags names={note.tags} catalog={catalog} search={search} />
				</div>
				<h3 className="wrap-anywhere text-[1.0625rem] leading-snug font-medium">
					<Link
						to="/journal/$id"
						params={{ id: note.id }}
						className="rounded-sm underline-offset-4 hover:underline"
					>
						{title}
					</Link>
				</h3>
				{hasPitfallContent ? (
					<NotePitfallContent pitfall={pitfall} />
				) : excerpt && excerpt !== title ? (
					<p className="wrap-anywhere text-sm leading-relaxed text-muted-foreground">
						{excerpt}
					</p>
				) : null}
			</Card>
		</article>
	);
}

import { useJournalProgressDay } from "@entities/note/api/queries";
import type { ProgressCommit, ProgressDay } from "@entities/note/model/types";
import { Disclosure } from "@shared/ui/disclosure/Disclosure";
import { Badge, Button, Card, Tag } from "@violet/ui";
import { GitCommitHorizontal } from "lucide-react";
import { useState } from "react";
import { JOURNAL_TIME_ZONE } from "../model/display";

const CLOCK = new Intl.DateTimeFormat("zh-CN", {
	timeZone: JOURNAL_TIME_ZONE,
	hour: "2-digit",
	minute: "2-digit",
	hourCycle: "h23",
});

const COMMIT_PREFIX = /^([a-z][\w-]*)(?:\([^)]*\))?!?:\s+(.+)$/;

/** 自动进展日卡：先显示预览，读者展开后才请求完整提交。 */
export function JournalProgressCard({ progress }: { progress: ProgressDay }) {
	const { commits, releases, project, first_at, last_at, commit_count, release_count } = progress;
	const remaining = commit_count - commits.length;
	const firstTime = CLOCK.format(new Date(first_at));
	const lastTime = first_at === last_at ? firstTime : CLOCK.format(new Date(last_at));

	return (
		<article>
			<Card className="min-w-0 gap-2.5 px-4 py-4.5 font-serif sm:px-5.5">
				<div className="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-2">
					<div className="flex min-w-0 flex-wrap items-center gap-2">
						<Badge tone="accent" icon={<GitCommitHorizontal />}>
							进展
						</Badge>
						<Tag size="sm" title={project.title} className="min-w-0 max-w-full">
							<span className="truncate">{project.title}</span>
						</Tag>
					</div>
					<p className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-xs text-muted-foreground tabular-nums">
						<span>
							<time dateTime={first_at}>{firstTime}</time>
							{firstTime !== lastTime && (
								<>
									{" – "}
									<time dateTime={last_at}>{lastTime}</time>
								</>
							)}
						</span>
						<span className="wrap-anywhere">
							{commit_count} 个提交 · {release_count} 次发布
						</span>
					</p>
				</div>
				{progress.summary && (
					<h3 className="wrap-anywhere text-[1.0625rem] leading-snug font-medium">
						{progress.summary}
					</h3>
				)}
				{commits.length > 0 && <CommitList commits={commits} label="提交预览" />}
				{(releases.length > 0 || remaining > 0) && (
					<div className="min-w-0 space-y-2 border-t border-border pt-2">
						{releases.length > 0 && (
							<ul aria-label="版本发布" className="flex min-w-0 flex-wrap gap-2">
								{releases.map((release) => (
									<li key={release.tag} className="min-w-0 max-w-full">
										<a
											className="inline-flex max-w-full rounded-lg hover:underline"
											href={release.url}
											title={release.title}
											target="_blank"
											rel="noreferrer"
										>
											<Tag size="sm" className="min-w-0 max-w-full">
												<span className="wrap-anywhere whitespace-normal">
													{release.tag}
												</span>
											</Tag>
										</a>
									</li>
								))}
							</ul>
						)}
						{remaining > 0 && (
							<RemainingCommits progress={progress} remaining={remaining} />
						)}
					</div>
				)}
			</Card>
		</article>
	);
}

function CommitList({ commits, label }: { commits: ProgressCommit[]; label: string }) {
	return (
		<ul aria-label={label} className="min-w-0 space-y-1 text-sm leading-relaxed">
			{commits.map((commit) => {
				const [, prefix, subject] = COMMIT_PREFIX.exec(commit.title) ?? [];
				return (
					<li key={commit.sha}>
						<a
							className="grid grid-cols-[minmax(0,3.5rem)_minmax(0,1fr)] items-baseline gap-2 rounded-sm underline-offset-4 hover:underline"
							href={commit.url}
							title={commit.title}
							target="_blank"
							rel="noreferrer"
						>
							<span
								aria-hidden="true"
								className="truncate font-mono text-xs text-muted-foreground"
							>
								{prefix ?? commit.sha.slice(0, 7)}
							</span>
							<span className="wrap-anywhere">{subject ?? commit.title}</span>
						</a>
					</li>
				);
			})}
		</ul>
	);
}

function RemainingCommits({ progress, remaining }: { progress: ProgressDay; remaining: number }) {
	const [opened, setOpened] = useState(false);
	const detail = useJournalProgressDay(progress.project.id, progress.day, opened);
	let rest: ProgressCommit[] | undefined;
	if (detail.data) {
		const previewShas = new Set(progress.commits.map(({ sha }) => sha));
		rest = detail.data.commits.filter(({ sha }) => !previewShas.has(sha));
	}

	return (
		<Disclosure
			className="border-0!"
			summary={<span className="text-sm text-muted-foreground">另 {remaining} 个提交</span>}
			summaryClassName="py-1! text-end!"
			contentClassName="p-1!"
			onOpenChange={(open) => {
				if (open) setOpened(true);
			}}
		>
			{rest ? (
				rest.length > 0 ? (
					<CommitList commits={rest} label="其余提交" />
				) : (
					<p role="status" className="text-sm text-muted-foreground">
						没有其余提交。
					</p>
				)
			) : detail.isError ? (
				<div className="flex flex-wrap items-center gap-2">
					<p role="status" className="text-sm text-muted-foreground">
						提交加载失败。
					</p>
					<Button
						size="sm"
						variant="outline"
						loading={detail.isFetching}
						onClick={() => void detail.refetch()}
					>
						重试加载提交
					</Button>
				</div>
			) : opened ? (
				<p role="status" className="text-sm text-muted-foreground">
					正在加载提交…
				</p>
			) : null}
		</Disclosure>
	);
}

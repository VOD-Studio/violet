import { Link } from "@tanstack/react-router";
import { Badge } from "@violet/ui";
import { cn } from "cn";
import type { ProjectRoadmapSummary } from "../model/roadmap-summary";
import type { Project } from "../model/types";
import { ProjectCover } from "./ProjectCover";

function RoadmapSummary({ title, summary }: { title: string; summary: ProjectRoadmapSummary }) {
	const { progress, in_progress: doing, latest_completed: latest } = summary;
	return (
		<div className="col-span-2 space-y-3 text-sm lg:col-span-1">
			<div>
				<p className="font-mono text-xs text-muted-foreground">现在在做</p>
				{doing.length === 0 ? (
					<p className="text-muted-foreground">暂无进行中</p>
				) : (
					<ul>
						{doing.map((item) => (
							<li key={item.id} className="truncate font-medium">
								<span
									aria-hidden="true"
									className="mr-1.5 inline-block size-1.5 rounded-full bg-primary align-middle"
								/>
								<span className="mr-1 font-mono text-xs text-muted-foreground">
									#{item.number}
								</span>
								{item.title}
							</li>
						))}
					</ul>
				)}
			</div>
			<div>
				<p className="font-mono text-xs text-muted-foreground">最近完成</p>
				{latest ? (
					<p className="truncate">
						<span className="mr-1 font-mono text-xs text-muted-foreground">
							#{latest.number}
						</span>
						{latest.title}
						{latest.completion_date ? (
							<span className="ml-1.5 font-mono text-xs text-muted-foreground">
								{latest.completion_date}
							</span>
						) : null}
					</p>
				) : (
					<p className="text-muted-foreground">暂无</p>
				)}
			</div>
			<div>
				<div
					role="progressbar"
					aria-label={`${title} 已完成占比`}
					aria-valuemin={0}
					aria-valuemax={100}
					aria-valuenow={progress.percent}
					className="h-1.5 overflow-hidden rounded-full bg-muted"
				>
					<div
						className="h-full rounded-full bg-primary"
						style={{ width: `${progress.percent}%` }}
					/>
				</div>
				<p className="mt-1 font-mono text-xs text-muted-foreground tabular-nums">
					已完成 {progress.completed}/{progress.total} · 进行中 {progress.in_progress} ·
					计划中 {progress.planned}
				</p>
			</div>
		</div>
	);
}

export interface ProjectRowProps {
	project: Project;
}

/**
 * 项目列表的一行：封面、标题、两行简介、技术栈，以及「现在在做」「最近完成」与进度。
 *
 * 整行可点，进入详情页；链接只在标题上（拉伸到整行），行内不嵌套别的链接。
 * 没有任何路线图条目的项目不显示摘要区，也就没有空的进度条。
 */
export function ProjectRow({ project }: ProjectRowProps) {
	const summary = project.roadmap && project.roadmap.progress.total > 0 ? project.roadmap : null;
	return (
		<li
			className={cn(
				"relative grid grid-cols-[4.5rem_minmax(0,1fr)] gap-x-4 gap-y-4 rounded-2xl border border-edge-hairline p-4 transition-colors hover:bg-muted/50 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring sm:grid-cols-[7rem_minmax(0,1fr)] sm:gap-x-5 sm:p-5",
				summary && "lg:grid-cols-[7rem_minmax(0,1fr)_17rem]",
			)}
		>
			<ProjectCover src={project.image_url} title={project.title} />
			<div className="min-w-0 space-y-2">
				<h2 className="text-xl font-bold sm:text-2xl">
					<Link
						to="/projects/$slug"
						params={{ slug: project.slug }}
						className="after:absolute after:inset-0 focus-visible:outline-none"
					>
						{project.title}
					</Link>
				</h2>
				{project.description ? (
					<p className="line-clamp-2 text-sm text-muted-foreground">
						{project.description}
					</p>
				) : null}
				{project.tech_stack && project.tech_stack.length > 0 ? (
					<ul className="flex flex-wrap gap-1.5" aria-label="技术栈">
						{project.tech_stack.map((tech) => (
							<li key={tech}>
								<Badge variant="secondary">{tech}</Badge>
							</li>
						))}
					</ul>
				) : null}
			</div>
			{summary ? <RoadmapSummary title={project.title} summary={summary} /> : null}
		</li>
	);
}

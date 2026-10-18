import { BackLink } from "@shared/ui/back-link";
import { ArrowUpRight } from "lucide-react";
import type { RoadmapProgress as RoadmapProgressData } from "../model/roadmap-summary";
import type { Project } from "../model/types";
import { RoadmapProgress } from "./RoadmapProgress";

export interface ProjectDetailHeaderProps {
	project: Project;
	/** 没有条目时不显示进度概览。 */
	progress: RoadmapProgressData;
}

const LINK =
	"inline-flex items-center gap-1 text-muted-foreground transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

/** 详情页头部：标题、简介、技术栈与外链在左，进度概览在右，底部一条细线与路线图分开。 */
export function ProjectDetailHeader({ project, progress }: ProjectDetailHeaderProps) {
	const stack = project.tech_stack ?? [];
	return (
		<header className="mb-8 border-b border-border/40 pb-8 md:mb-10 md:pb-10">
			<BackLink label="项目" to="/projects" className="mb-8" />
			<div className="flex flex-wrap items-end justify-between gap-x-16 gap-y-8">
				<div className="min-w-0 max-w-2xl flex-1">
					<p className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground/60 uppercase">
						Roadmap
					</p>
					<h1 className="mt-2 text-4xl leading-tight font-normal tracking-[-0.03em] sm:text-5xl">
						{project.title}
					</h1>
					{project.description ? (
						<p className="mt-4 font-reading leading-relaxed text-muted-foreground">
							{project.description}
						</p>
					) : null}
					{stack.length > 0 || project.url || project.github_url ? (
						<div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-xs">
							{stack.length > 0 ? (
								<ul
									aria-label="技术栈"
									className="flex flex-wrap items-center gap-x-2 text-muted-foreground/80"
								>
									{stack.map((tech) => (
										<li
											key={tech}
											className="not-last:after:ml-2 not-last:after:text-muted-foreground/40 not-last:after:content-['·']"
										>
											{tech}
										</li>
									))}
								</ul>
							) : null}
							{project.url ? (
								<a
									href={project.url}
									target="_blank"
									rel="noreferrer"
									className={LINK}
								>
									演示
									<ArrowUpRight className="size-3.5" aria-hidden="true" />
								</a>
							) : null}
							{project.github_url ? (
								<a
									href={project.github_url}
									target="_blank"
									rel="noreferrer"
									className={LINK}
								>
									源码
									<ArrowUpRight className="size-3.5" aria-hidden="true" />
								</a>
							) : null}
						</div>
					) : null}
				</div>
				{progress.total > 0 ? <RoadmapProgress progress={progress} /> : null}
			</div>
		</header>
	);
}

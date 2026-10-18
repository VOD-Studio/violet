import { BackLink } from "@shared/ui/back-link";
import { Badge, Button } from "@violet/ui";
import { Code, ExternalLink } from "lucide-react";
import type { RoadmapProgress as RoadmapProgressData } from "../model/roadmap-summary";
import type { Project } from "../model/types";
import { RoadmapProgress } from "./RoadmapProgress";

export interface ProjectDetailHeaderProps {
	project: Project;
	/** 没有条目时不显示进度概览。 */
	progress: RoadmapProgressData;
}

/** 详情页头部：标题、简介、技术栈、演示与源码链接、进度概览。 */
export function ProjectDetailHeader({ project, progress }: ProjectDetailHeaderProps) {
	return (
		<header className="mb-8 md:mb-10">
			<BackLink label="项目" to="/projects" className="mb-6" />
			<div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-6">
				<div className="min-w-0 max-w-2xl flex-1">
					<p className="mb-2 font-mono text-xs tracking-[0.3em] text-muted-foreground uppercase">
						Roadmap
					</p>
					<h1 className="font-mono text-4xl font-bold">{project.title}</h1>
					{project.description ? (
						<p className="mt-3 leading-relaxed text-muted-foreground">
							{project.description}
						</p>
					) : null}
					{project.tech_stack && project.tech_stack.length > 0 ? (
						<ul className="mt-4 flex flex-wrap gap-1.5" aria-label="技术栈">
							{project.tech_stack.map((tech) => (
								<li key={tech}>
									<Badge variant="secondary">{tech}</Badge>
								</li>
							))}
						</ul>
					) : null}
					{project.url || project.github_url ? (
						<div className="mt-5 flex flex-wrap items-center gap-2">
							{project.url ? (
								<Button variant="outline" size="sm" className="gap-1.5" asChild>
									<a href={project.url} target="_blank" rel="noreferrer">
										<ExternalLink className="size-3.5" />
										演示
									</a>
								</Button>
							) : null}
							{project.github_url ? (
								<Button variant="outline" size="sm" className="gap-1.5" asChild>
									<a href={project.github_url} target="_blank" rel="noreferrer">
										<Code className="size-3.5" />
										源码
									</a>
								</Button>
							) : null}
						</div>
					) : null}
				</div>
				{progress.total > 0 ? <RoadmapProgress progress={progress} /> : null}
			</div>
		</header>
	);
}

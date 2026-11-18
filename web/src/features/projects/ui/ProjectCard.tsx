import { formatDate } from "@shared/lib/date";
import { validateUrl } from "@shared/lib/url";
import { Link } from "@tanstack/react-router";
import {
	Badge,
	Button,
	CardFrame,
	CardFrameBody,
	CardFrameImage,
	CardFrameTitle,
	GithubIcon,
	iconProps,
	ProgressBar,
	Tag,
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@violet/ui";
import { BookOpen, ExternalLink } from "lucide-react";
import type { ReactNode } from "react";
import type { ProjectRoadmapSummary } from "../model/roadmap-summary";
import { PROJECT_STATUS_LABELS, type Project, type ProjectStatus } from "../model/types";
import { ProjectCover } from "./ProjectCover";

const STATUS_TONES = {
	active: "accent",
	stable: "ok",
	archived: "off",
} as const satisfies Record<ProjectStatus, string>;

function projectHref(value: string, allowSitePath = false) {
	const href = value.trim();
	if (href.includes("\\")) return undefined;
	for (let index = 0; index < href.length; index++) {
		const code = href.charCodeAt(index);
		if (code < 32 || code === 127) return undefined;
	}
	if (allowSitePath && href.startsWith("/") && !href.startsWith("//")) return href;
	if (!/^https?:\/\/[^/]/i.test(href) || validateUrl(href) !== null) return undefined;
	const { username, password } = new URL(href);
	return username || password ? undefined : href;
}

function releaseHref({ html_url, tag }: NonNullable<Project["release"]>) {
	const href = projectHref(html_url);
	if (!href) return undefined;
	const { origin, pathname } = new URL(href);
	if (origin !== "https://github.com") return undefined;
	const urlTag = /^\/[^/]+\/[^/]+\/releases\/tag\/(.+)$/.exec(pathname)?.[1];
	if (!urlTag) return undefined;
	try {
		return decodeURIComponent(urlTag) === tag ? href : undefined;
	} catch {
		return undefined;
	}
}

interface ProjectShortcutProps {
	href: string;
	label: string;
	children: ReactNode;
}

function ProjectShortcut({ href, label, children }: ProjectShortcutProps) {
	const external = !href.startsWith("/");
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<Button asChild iconOnly variant="ghost" size="sm" className="relative z-2">
					<a
						href={href}
						aria-label={label}
						target={external ? "_blank" : undefined}
						rel={external ? "noopener noreferrer" : undefined}
					>
						{children}
					</a>
				</Button>
			</TooltipTrigger>
			<TooltipContent>{label}</TooltipContent>
		</Tooltip>
	);
}

function RoadmapSummary({ title, summary }: { title: string; summary: ProjectRoadmapSummary }) {
	const { progress, in_progress: doing } = summary;
	return (
		<div className="space-y-2">
			<div className="flex flex-wrap justify-between gap-x-3">
				<span>路线图</span>
				<span className="font-mono tabular-nums">
					{progress.completed} / {progress.total} · {progress.percent}%
				</span>
			</div>
			<ProgressBar value={progress.percent} aria-label={`${title} 已完成占比`} />
			{doing.length > 0 && (
				<div>
					<p>正在做</p>
					<ul aria-label="正在做">
						{doing.slice(0, 2).map((item) => (
							<li key={item.id} className="wrap-anywhere">
								<span className="font-mono">#{item.number}</span> {item.title}
							</li>
						))}
					</ul>
				</div>
			)}
		</div>
	);
}

function ReleaseSummary({ release }: { release: NonNullable<Project["release"]> }) {
	const href = releaseHref(release);
	const date = formatDate(release.published_at, "iso-date", "", "Asia/Shanghai");
	return (
		<div className="flex flex-wrap justify-between gap-x-3 gap-y-1">
			<p className="wrap-anywhere">
				最新{" "}
				{href ? (
					<a
						href={href}
						target="_blank"
						rel="noopener noreferrer"
						className="relative z-2 font-mono text-foreground underline underline-offset-4"
					>
						{release.tag}
					</a>
				) : (
					<span className="font-mono text-foreground">{release.tag}</span>
				)}
				{date && (
					<>
						{" · "}
						<time dateTime={release.published_at} className="font-mono">
							{date}
						</time>
					</>
				)}
			</p>
			<p>{release.count} 个版本</p>
		</div>
	);
}

export interface ProjectCardProps {
	project: Project;
}

/** 公开项目卡片：详情链接扩展到整卡，独立入口不嵌套在详情链接内。 */
export function ProjectCard({ project }: ProjectCardProps) {
	const { release, roadmap } = project;
	const techStack = project.tech_stack ?? [];
	const hasRoadmap = roadmap && roadmap.progress.total > 0;
	const visit = projectHref(project.url, true);
	const github = projectHref(project.github_url);
	const docs = projectHref(project.docs_url, true);
	return (
		<li className="min-w-0">
			<CardFrame className="flex h-full flex-col">
				<CardFrameImage className="aspect-16/9 shrink-0">
					<ProjectCover src={project.image_url} title={project.title} />
				</CardFrameImage>
				<CardFrameBody className="grow gap-3 p-4 sm:p-5">
					<div className="flex flex-wrap items-center gap-x-2.5 gap-y-2">
						<h2 className="min-w-0 wrap-anywhere">
							<CardFrameTitle asChild className="font-mono text-xl sm:text-2xl">
								<Link
									to="/projects/$slug"
									params={{ slug: project.slug }}
									preload={false}
								>
									{project.title}
								</Link>
							</CardFrameTitle>
						</h2>
						<Badge tone={STATUS_TONES[project.status]}>
							{PROJECT_STATUS_LABELS[project.status]}
						</Badge>
						{(github || docs || visit) && (
							<div className="ml-auto flex items-center gap-0.5">
								{github && (
									<ProjectShortcut href={github} label="GitHub">
										<GithubIcon className="size-4" />
									</ProjectShortcut>
								)}
								{docs && (
									<ProjectShortcut href={docs} label="文档">
										<BookOpen {...iconProps(16)} aria-hidden="true" />
									</ProjectShortcut>
								)}
								{visit && (
									<ProjectShortcut href={visit} label="访问项目">
										<ExternalLink {...iconProps(16)} aria-hidden="true" />
									</ProjectShortcut>
								)}
							</div>
						)}
					</div>
					{project.description && (
						<p className="line-clamp-2 text-sm leading-relaxed">
							{project.description}
						</p>
					)}
					{techStack.length > 0 && (
						<ul className="flex flex-wrap gap-1.5" aria-label="技术栈">
							{techStack.map((tech) => (
								<li key={tech} className="min-w-0 wrap-anywhere">
									<Tag size="sm">{tech}</Tag>
								</li>
							))}
						</ul>
					)}
					{(release || hasRoadmap) && (
						<div className="mt-auto border-t border-edge-hairline pt-4 text-sm text-muted-foreground">
							{release ? (
								<ReleaseSummary release={release} />
							) : hasRoadmap ? (
								<RoadmapSummary title={project.title} summary={roadmap} />
							) : null}
						</div>
					)}
				</CardFrameBody>
			</CardFrame>
		</li>
	);
}

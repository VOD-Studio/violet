import { useProjects } from "@entities/project/api/queries";
import { useSiteIdentity } from "@entities/site-identity/api/queries";
import { AboutChapter } from "@features/about/ui/AboutChapter";
import { AboutSectionState } from "@features/about/ui/AboutSectionState";
import { Link } from "@tanstack/react-router";
import { Avatar, Button, ProgressBar, Skeleton } from "@violet/ui";

/** 使用全站统一的匿名站点身份，不用当前登录人的资料代替站长。 */
export function GardenerSection() {
	const identity = useSiteIdentity();
	return (
		<AboutChapter id="gardener" title="园丁">
			{identity.isPending ? (
				<Skeleton className="h-24 w-full rounded-xl" />
			) : identity.isError ? (
				<AboutSectionState
					message="暂时无法读取站长资料。"
					isRetrying={identity.isFetching}
					onRetry={() => void identity.refetch()}
				/>
			) : (
				<div className="min-w-0 space-y-4">
					<div className="flex items-center gap-4">
						<Avatar
							name={identity.data.owner_name}
							src={identity.data.avatar_url || undefined}
							size={64}
						/>
						<p className="font-serif text-2xl font-semibold wrap-break-word">
							{identity.data.owner_name}
						</p>
					</div>
					<p className="leading-relaxed text-muted-foreground">{identity.data.bio}</p>
					{identity.data.location && (
						<p className="text-sm text-muted-foreground">{identity.data.location}</p>
					)}
					<div className="flex flex-wrap gap-2">
						{identity.data.social_links
							.filter((link) => link.kind === "github")
							.concat(identity.data.subscription_channels)
							.map((link) => (
								<Button key={link.kind} variant="outline" size="sm" asChild>
									<a href={link.href}>{link.label}</a>
								</Button>
							))}
						<Button variant="outline" size="sm" asChild>
							<Link to="/chat">去聊天</Link>
						</Button>
					</div>
				</div>
			)}
		</AboutChapter>
	);
}

/** 复用项目列表现有的路线图摘要，不逐项目发请求，也不等待它才能显示文章正文。 */
export function GrowingSection() {
	const projects = useProjects();
	const growing = (projects.data ?? [])
		.flatMap((project) =>
			project.roadmap?.in_progress.length ? [{ project, roadmap: project.roadmap }] : [],
		)
		.slice(0, 3);
	return (
		<AboutChapter
			id="growing"
			title="正在发芽"
			intro="此刻在做的项目，以及路线图上正在推进的事项。"
		>
			{projects.isPending ? (
				<Skeleton className="h-28 w-full rounded-xl" />
			) : projects.isError ? (
				<AboutSectionState
					message="暂时无法读取项目路线图。"
					isRetrying={projects.isFetching}
					onRetry={() => void projects.refetch()}
				/>
			) : growing.length === 0 ? (
				<AboutSectionState message="目前没有公开标记为进行中的事项。" />
			) : (
				<ul className="divide-y divide-border border-y border-border">
					{growing.map(({ project, roadmap }) => (
						<li key={project.id} className="space-y-4 px-1 py-5">
							<div className="min-w-0 space-y-2">
								<Link
									to="/projects/$slug"
									params={{ slug: project.slug }}
									className="font-medium hover:underline"
								>
									{project.title}
								</Link>
								{project.description && (
									<p className="text-sm text-muted-foreground">
										{project.description}
									</p>
								)}
								<ProgressBar
									value={roadmap.progress.percent}
									label={`${project.title} 路线图进度`}
									hint={`已完成 ${roadmap.progress.completed}/${roadmap.progress.total} 项`}
								/>
							</div>
							<ul className="space-y-2 text-sm">
								{roadmap.in_progress.map((item) => (
									<li key={item.id}>
										<Link
											to="/projects/$slug"
											params={{ slug: project.slug }}
											search={{ q: item.title }}
											className="hover:underline"
										>
											<span className="mr-2 font-mono text-xs text-muted-foreground">
												#{item.number}
											</span>
											{item.title}
										</Link>
									</li>
								))}
							</ul>
						</li>
					))}
				</ul>
			)}
			<Button className="mt-5" variant="outline" size="sm" asChild>
				<Link to="/projects">查看全部项目</Link>
			</Button>
		</AboutChapter>
	);
}

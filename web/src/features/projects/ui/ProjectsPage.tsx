import { useProjects } from "@entities/project/api/queries";
import { PROJECT_STATUS_LABELS, type Project } from "@entities/project/model/types";
import { Button, Empty, PageShell, Segmented, Skeleton, TooltipProvider } from "@violet/ui";
import { ProjectCard } from "./ProjectCard";

/** 项目总览的筛选口径；稳定迭代与进行中的项目同组。 */
export type ProjectFilter = "all" | "active" | "archived";

/** 项目总览数据及由路由控制的筛选。 */
export interface ProjectsPageProps {
	/** 路由 loader 的首屏数据。 */
	initialData?: Project[];
	filter: ProjectFilter;
	onFilterChange: (filter: ProjectFilter) => void;
}

const GRID_CLASS = "grid grid-cols-1 gap-6 md:grid-cols-2 lg:gap-8";
const SHELL_CLASS = "max-w-292"; // 1120px 内容宽度，加上 PageShell 桌面两侧的内边距。
const HEADING_CLASS = "text-4xl font-semibold tracking-tight sm:text-5xl";

/** 路由尚未取得列表时的骨架；请求失败后可在当前地址重试。 */
export function ProjectsPageFallback({ onRetry }: { onRetry?: () => void }) {
	return (
		<PageShell className={SHELL_CLASS}>
			<h1 className={`mb-6 md:mb-10 ${HEADING_CLASS}`}>项目</h1>
			{onRetry ? <ProjectListError onRetry={onRetry} /> : <ProjectListSkeleton />}
		</PageShell>
	);
}

function ProjectListError({ onRetry }: { onRetry: () => void }) {
	return (
		<Empty
			title="项目暂时加载失败"
			description="请稍后重试。"
			action={<Button onClick={onRetry}>重试</Button>}
			className="py-20"
		/>
	);
}

function ProjectListSkeleton() {
	return (
		<div role="status" aria-label="正在加载项目" className={GRID_CLASS}>
			<Skeleton className="aspect-4/3" />
			<Skeleton className="aspect-4/3" />
		</div>
	);
}

/** 项目总览保留后端展示顺序，筛选只使用已加载的列表。 */
export function ProjectsPage({ initialData, filter, onFilterChange }: ProjectsPageProps) {
	const { data: projects, isError, refetch } = useProjects({}, initialData);
	let visible = projects;
	if (filter !== "all") {
		visible = projects?.filter(({ status }) => {
			if (filter === "archived") return status === "archived";
			return status === "active" || status === "stable";
		});
	}
	return (
		<PageShell className={SHELL_CLASS}>
			<div className="mb-6 flex flex-wrap items-end justify-between gap-x-8 gap-y-4 md:mb-10">
				<h1 className={HEADING_CLASS}>项目</h1>
				<Segmented<ProjectFilter>
					aria-label="筛选项目状态"
					value={filter}
					onValueChange={onFilterChange}
					segments={[
						{
							value: "all",
							label: "全部",
							trailing: projects && (
								<span className="font-mono tabular-nums">{projects.length}</span>
							),
						},
						{ value: "active", label: PROJECT_STATUS_LABELS.active },
						{ value: "archived", label: PROJECT_STATUS_LABELS.archived },
					]}
				/>
			</div>
			{visible === undefined ? (
				isError ? (
					<ProjectListError onRetry={() => void refetch()} />
				) : (
					<ProjectListSkeleton />
				)
			) : visible.length === 0 ? (
				<Empty
					title="暂无项目"
					description={projects?.length ? "没有符合当前筛选的项目" : "还没有发布任何项目"}
					className="py-20"
				/>
			) : (
				<TooltipProvider>
					<ul aria-label="项目列表" className={GRID_CLASS}>
						{visible.map((project) => (
							<ProjectCard key={project.id} project={project} />
						))}
					</ul>
				</TooltipProvider>
			)}
		</PageShell>
	);
}

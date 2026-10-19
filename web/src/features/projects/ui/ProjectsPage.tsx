import { Empty, PageHeader, PageShell } from "@violet/ui";
import { useProjects } from "../api/queries";
import type { Project } from "../model/types";
import { ProjectRow } from "./ProjectRow";

export interface ProjectsPageProps {
	/** 路由 loader 取到的列表，作为首帧数据，水合时才与直出的 HTML 一致。 */
	initialData?: Project[];
}

/** 项目列表页：每个项目一行，按后端给出的站主顺序排列。 */
export function ProjectsPage({ initialData }: ProjectsPageProps) {
	const { data: projects } = useProjects({}, initialData);
	return (
		<PageShell>
			<PageHeader
				eyebrow="All Projects"
				title="项目"
				description="每个项目正在做什么、最近交付了什么。"
			/>
			{projects === undefined ? null : projects.length === 0 ? (
				<Empty
					title="暂无项目"
					description="还没有发布任何项目"
					className="py-20"
					size="lg"
				/>
			) : (
				<ul className="space-y-4">
					{projects.map((project) => (
						<ProjectRow key={project.id} project={project} />
					))}
				</ul>
			)}
		</PageShell>
	);
}

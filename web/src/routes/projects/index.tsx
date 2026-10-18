import { projectKeys } from "@features/projects/api/keys";
import { fetchProjects } from "@features/projects/api/queries";
import { ProjectsPage } from "@features/projects/ui/ProjectsPage";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/projects/")({
	// SSR 预取项目列表，首屏直出；列表同时作为组件的首帧数据
	loader: ({ context }) =>
		context.queryClient.ensureQueryData({
			queryKey: projectKeys.list({}),
			queryFn: () => fetchProjects({}),
		}),
	component: ProjectsRoute,
});

function ProjectsRoute() {
	return <ProjectsPage initialData={Route.useLoaderData()} />;
}

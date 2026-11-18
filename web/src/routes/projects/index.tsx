import { projectKeys } from "@features/projects/api/keys";
import { fetchProjects } from "@features/projects/api/queries";
import {
	type ProjectFilter,
	ProjectsPage,
	ProjectsPageFallback,
} from "@features/projects/ui/ProjectsPage";
import { createFileRoute, useRouter } from "@tanstack/react-router";

interface ProjectSearch {
	status?: Exclude<ProjectFilter, "all">;
}

export const Route = createFileRoute("/projects/")({
	validateSearch: (search: Record<string, unknown>): ProjectSearch => {
		const { status } = search;
		return { status: status === "active" || status === "archived" ? status : undefined };
	},
	// SSR 预取项目列表，首屏直出；列表同时作为组件的首帧数据
	loader: ({ context }) =>
		context.queryClient.ensureQueryData({
			queryKey: projectKeys.list({}),
			queryFn: () => fetchProjects({}),
		}),
	pendingComponent: () => <ProjectsPageFallback />,
	errorComponent: ProjectsError,
	component: ProjectsRoute,
});

function ProjectsRoute() {
	const { status } = Route.useSearch();
	const navigate = Route.useNavigate();
	const changeFilter = (filter: ProjectFilter) => {
		if ((status ?? "all") === filter) return;
		void navigate({
			search: { status: filter === "all" ? undefined : filter },
			resetScroll: false,
		});
	};
	return (
		<ProjectsPage
			initialData={Route.useLoaderData()}
			filter={status ?? "all"}
			onFilterChange={changeFilter}
		/>
	);
}

function ProjectsError() {
	const router = useRouter();
	return <ProjectsPageFallback onRetry={() => void router.invalidate()} />;
}

import { projectRoadmapQueryOptions } from "@features/projects/api/queries";
import type { RoadmapDetail } from "@features/projects/model/roadmap";
import { ProjectDetailPage } from "@features/projects/ui/ProjectDetailPage";
import { ApiError } from "@shared/api/error";
import { createFileRoute, notFound } from "@tanstack/react-router";

export const Route = createFileRoute("/projects/$slug")({
	// SSR 预取路线图并脱水合，首屏直出；未知 slug 渲染统一 404（状态码也是 404）
	loader: async ({ context, params }) => {
		try {
			return await context.queryClient.ensureQueryData(
				projectRoadmapQueryOptions(params.slug),
			);
		} catch (error) {
			if (error instanceof ApiError && error.status === 404) throw notFound();
			throw error;
		}
	},
	staticData: { navTitle: (detail: RoadmapDetail | null) => detail?.project.title },
	head: ({ loaderData }) => {
		const detail = loaderData as RoadmapDetail | undefined;
		if (!detail) return { meta: [] };
		const { title, description } = detail.project;
		return {
			meta: [
				{ title: `${title} · 路线图` },
				...(description ? [{ name: "description", content: description }] : []),
			],
		};
	},
	component: ProjectDetailRoute,
});

function ProjectDetailRoute() {
	const { slug } = Route.useParams();
	const initialData = Route.useLoaderData();
	return <ProjectDetailPage slug={slug} initialData={initialData} />;
}

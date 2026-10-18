import { projectRoadmapQueryOptions } from "@features/projects/api/queries";
import type { RoadmapFilters } from "@features/projects/lib/roadmap-filter";
import type { RoadmapDetail } from "@features/projects/model/roadmap";
import { ProjectDetailPage } from "@features/projects/ui/ProjectDetailPage";
import { ApiError } from "@shared/api/error";
import { createFileRoute, notFound } from "@tanstack/react-router";

export const Route = createFileRoute("/projects/$slug")({
	validateSearch: (search: Record<string, unknown>): RoadmapFilters => ({
		q: searchText(search.q),
		tag: searchText(search.tag),
	}),
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

function searchText(value: unknown) {
	// 路由会把直接输入 URL 的数字和布尔文本解码成原始值，搜索仍按文字处理。
	return typeof value === "string" || typeof value === "number" || typeof value === "boolean"
		? String(value) || undefined
		: undefined;
}

function ProjectDetailRoute() {
	const { slug } = Route.useParams();
	const initialData = Route.useLoaderData();
	const filters = Route.useSearch();
	const navigate = Route.useNavigate();
	return (
		<ProjectDetailPage
			key={slug}
			slug={slug}
			initialData={initialData}
			filters={filters}
			onFiltersChange={(search) =>
				void navigate({ search, replace: true, resetScroll: false })
			}
		/>
	);
}

import type { ShowcaseSearch } from "@features/ui-showcase/model/search";
import { showcaseSearchSchema } from "@features/ui-showcase/model/search";
import { ShowcasePage } from "@features/ui-showcase/ui/ShowcasePage";
import { createFileRoute, useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/ui")({
	validateSearch: showcaseSearchSchema,
	head: () => ({
		meta: [
			{ title: "组件陈列室 · @violet/ui" },
			{
				name: "description",
				content:
					"按占地陈列 @violet/ui 与站点组件的真实实现，可逐件切换状态、明暗、季节与减弱动态。",
			},
		],
	}),
	component: ShowcaseRoute,
});

function ShowcaseRoute() {
	const search = Route.useSearch();
	const navigate = useNavigate({ from: Route.fullPath });
	const update = (patch: Partial<ShowcaseSearch>) =>
		navigate({ search: (previous) => ({ ...previous, ...patch }), replace: true });
	return <ShowcasePage search={search} onChange={update} />;
}

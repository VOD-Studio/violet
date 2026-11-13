import { SITE_URL } from "@shared/config/env";
import { createFileRoute } from "@tanstack/react-router";
import { BlogPending, BlogResults } from "@widgets/BlogPage/BlogResults";
import { loadBlog } from "@widgets/BlogPage/lib/load-blog";
import { blogHref, parseBlogSearch } from "@widgets/BlogPage/lib/search";

function BlogRoute() {
	const search = Route.useSearch();
	const { limit } = Route.useLoaderData();
	const navigate = Route.useNavigate();
	return (
		<BlogResults
			view="posts"
			search={search}
			limit={limit}
			onSearchChange={(next) => {
				void navigate({ search: next, resetScroll: next.page !== search.page });
			}}
		/>
	);
}

export const Route = createFileRoute("/blog/_browse/")({
	validateSearch: parseBlogSearch,
	loaderDeps: ({ search }) => search,
	loader: ({ context, deps }) => loadBlog(context.queryClient, "posts", deps),
	head: ({ loaderData }) => ({
		meta: [{ title: "博客" }],
		links: [
			{
				rel: "canonical",
				href: `${SITE_URL.replace(/\/+$/, "")}${blogHref("posts", loaderData?.search ?? {})}`,
			},
		],
	}),
	component: BlogRoute,
	pendingComponent: BlogPending,
});

import { SITE_URL } from "@shared/config/env";
import { createFileRoute } from "@tanstack/react-router";
import { BlogPending, BlogResults } from "@widgets/BlogPage/BlogResults";
import { loadBlog } from "@widgets/BlogPage/lib/load-blog";
import { type BlogSearch, blogHref, parseBlogSearch } from "@widgets/BlogPage/lib/search";

function ArchiveRoute() {
	const search = Route.useSearch();
	const { limit } = Route.useLoaderData();
	const navigate = Route.useNavigate();
	return (
		<BlogResults
			view="archive"
			search={search}
			limit={limit}
			onSearchChange={(next) => {
				void navigate({ search: next, resetScroll: false, hash: "" });
			}}
		/>
	);
}

export const Route = createFileRoute("/blog/_browse/archive")({
	validateSearch: (search): BlogSearch => {
		const { tag } = parseBlogSearch(search);
		return { tag, source: undefined, page: undefined };
	},
	loaderDeps: ({ search }) => search,
	loader: ({ context, deps }) => loadBlog(context.queryClient, "archive", deps),
	head: ({ loaderData }) => ({
		meta: [{ title: "归档 · 博客" }],
		links: [
			{
				rel: "canonical",
				href: `${SITE_URL.replace(/\/+$/, "")}${blogHref("archive", loaderData?.search ?? {})}`,
			},
		],
	}),
	component: ArchiveRoute,
	pendingComponent: BlogPending,
});

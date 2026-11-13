import { createFileRoute, Outlet, useMatches, useNavigate } from "@tanstack/react-router";
import { BlogPage } from "@widgets/BlogPage/BlogPage";
import { BLOG_VIEW_PATHS } from "@widgets/BlogPage/lib/search";

function BlogLayout() {
	const match = useMatches({
		select: (matches) =>
			matches.find(
				(candidate) =>
					candidate.routeId === "/blog/_browse/" ||
					candidate.routeId === "/blog/_browse/series/" ||
					candidate.routeId === "/blog/_browse/archive",
			),
	});
	const navigate = useNavigate();
	if (!match) return <Outlet />;
	const view =
		match.routeId === "/blog/_browse/series/"
			? "series"
			: match.routeId === "/blog/_browse/archive"
				? "archive"
				: "posts";
	const search = match.search;
	return (
		<BlogPage
			view={view}
			search={search}
			onSearchChange={(next) => {
				void navigate({
					to: BLOG_VIEW_PATHS[view],
					search: next,
					resetScroll: next.page !== search.page,
					hash: "",
				});
			}}
		>
			<Outlet />
		</BlogPage>
	);
}

export const Route = createFileRoute("/blog/_browse")({ component: BlogLayout });

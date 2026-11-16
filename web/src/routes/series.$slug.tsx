import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/series/$slug")({
	beforeLoad: ({ location, params }) => {
		const target = new URL(location.href, "http://localhost");
		target.pathname = `/blog/series/${encodeURIComponent(params.slug)}`;
		throw redirect({
			href: `${target.pathname}${target.search}${target.hash}`,
			statusCode: 301,
		});
	},
});

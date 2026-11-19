import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/kanban")({
	beforeLoad: ({ location }) => {
		const target = new URL(location.href, "http://localhost");
		target.pathname = "/projects/kanban/docs";
		throw redirect({
			href: `${target.pathname}${target.search}${target.hash}`,
			statusCode: 301,
		});
	},
});

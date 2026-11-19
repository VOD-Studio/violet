import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/inkline/")({
	beforeLoad: ({ location }) => {
		const target = new URL(location.href, "http://localhost");
		target.pathname = "/projects/inkline/docs";
		throw redirect({
			href: `${target.pathname}${target.search}${target.hash}`,
			statusCode: 301,
		});
	},
});

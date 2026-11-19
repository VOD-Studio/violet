import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/editor-guide/")({
	beforeLoad: ({ location }) => {
		const target = new URL(location.href, "http://localhost");
		target.pathname = "/projects/violet/docs/editor";
		throw redirect({
			href: `${target.pathname}${target.search}${target.hash}`,
			statusCode: 301,
		});
	},
});

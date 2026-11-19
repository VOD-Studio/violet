import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/persona")({
	beforeLoad: ({ location }) => {
		const target = new URL(location.href, "http://localhost");
		target.pathname = "/chat/personas";
		throw redirect({
			href: `${target.pathname}${target.search}${target.hash}`,
			statusCode: 301,
		});
	},
});

import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/series/")({
	beforeLoad: ({ location }) => {
		const url = new URL(location.href, "http://localhost");
		url.pathname = "/blog/series";
		throw redirect({ href: `${url.pathname}${url.search}${url.hash}`, statusCode: 301 });
	},
});

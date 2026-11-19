import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/profile/")({
	beforeLoad: ({ location }) => {
		const url = new URL(location.href, "http://localhost");
		throw redirect({ href: `/settings${url.search}${url.hash}`, statusCode: 301 });
	},
});

import { findSectionBySlug } from "@features/inkline-workbench/model/sections";
import { createFileRoute, notFound, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/inkline/$section")({
	beforeLoad: ({ location, params }) => {
		if (!findSectionBySlug(params.section)) throw notFound();
		const target = new URL(location.href, "http://localhost");
		target.pathname = `/projects/inkline/docs/${encodeURIComponent(params.section)}`;
		throw redirect({
			href: `${target.pathname}${target.search}${target.hash}`,
			statusCode: 301,
		});
	},
});

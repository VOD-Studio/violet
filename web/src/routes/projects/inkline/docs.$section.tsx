import { findSectionBySlug } from "@features/inkline-workbench/model/sections";
import { SITE_URL } from "@shared/config/env";
import { createFileRoute, notFound } from "@tanstack/react-router";

export const Route = createFileRoute("/projects/inkline/docs/$section")({
	beforeLoad: ({ params }) => {
		if (!findSectionBySlug(params.section)) throw notFound();
	},
	head: ({ params }) => ({
		meta: [
			{ title: `${findSectionBySlug(params.section)?.title ?? "手绘"} · @violetjs/inkline` },
		],
		links: [{ rel: "canonical", href: `${SITE_URL}/projects/inkline/docs/${params.section}` }],
	}),
});

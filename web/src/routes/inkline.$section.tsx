import { findSectionBySlug } from "@features/inkline-workbench/model/sections";
import { createFileRoute, notFound } from "@tanstack/react-router";

export const Route = createFileRoute("/inkline/$section")({
	beforeLoad: ({ params }) => {
		if (!findSectionBySlug(params.section)) throw notFound();
	},
	head: ({ params }) => ({
		meta: [
			{ title: `${findSectionBySlug(params.section)?.title ?? "手绘"} · @violetjs/inkline` },
		],
	}),
});

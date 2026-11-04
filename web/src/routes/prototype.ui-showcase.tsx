import { VariantA } from "@features/ui-showcase-prototype/VariantA";
import { VariantB } from "@features/ui-showcase-prototype/VariantB";
import { VariantC } from "@features/ui-showcase-prototype/VariantC";
import { CATEGORIES, EXHIBITS } from "@features/ui-showcase-prototype/exhibits";
import { type ProtoState, Switcher } from "@features/ui-showcase-prototype/shared";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";

/**
 * PROTOTYPE — 可丢弃。组件展示页的展柜布局：三个变体用 ?variant=A|B|C 切换。
 * 问题：按占地分区的展柜，视觉与组织怎么做才既放得下展品又有陈列感？
 * 评审后胜出者折进正式展示页，其余随本分支留作一手资料。
 */
const searchSchema = z.object({
	variant: z.enum(["A", "B", "C"]).catch("A"),
	season: z.enum(["春", "夏", "秋", "冬"]).catch("春"),
	mode: z.enum(["light", "dark"]).catch("light"),
	outline: z.boolean().catch(false),
	reduced: z.boolean().catch(false),
	cat: z.enum(["全部", ...CATEGORIES]).catch("全部"),
	open: z.string().optional().catch(undefined),
});

export const Route = createFileRoute("/prototype/ui-showcase")({
	validateSearch: searchSchema,
	component: UiShowcasePrototype,
});

const VARIANTS = [
	{ key: "A", name: "纸面展区" },
	{ key: "B", name: "陈列室" },
	{ key: "C", name: "橱窗长廊" },
];

function UiShowcasePrototype() {
	const search = Route.useSearch();
	const navigate = useNavigate({ from: Route.fullPath });
	const s: ProtoState = {
		season: search.season,
		mode: search.mode,
		outline: search.outline,
		reduced: search.reduced,
		cat: search.cat,
		open: search.open ?? null,
	};
	const set = (patch: Partial<ProtoState>) =>
		navigate({
			search: (prev) => {
				const next = { ...prev, ...patch } as Record<string, unknown>;
				if (patch.open === null) next.open = undefined;
				return next as typeof prev;
			},
			replace: true,
		});
	const exhibits = EXHIBITS.filter((e) => s.cat === "全部" || e.category === s.cat);
	const props = { s, set, exhibits };
	return (
		<>
			{search.variant === "A" && <VariantA {...props} />}
			{search.variant === "B" && <VariantB {...props} />}
			{search.variant === "C" && <VariantC {...props} />}
			<Switcher
				variants={VARIANTS}
				current={search.variant}
				onChange={(variant) => navigate({ search: (prev) => ({ ...prev, variant }), replace: true })}
			/>
		</>
	);
}

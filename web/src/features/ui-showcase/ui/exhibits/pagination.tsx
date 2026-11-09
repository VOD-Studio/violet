import { Pagination } from "@violet/ui";
import { useState } from "react";
import type { Exhibit, ExhibitRenderProps } from "../../model/exhibit";

interface Sample {
	id: string;
	caption: string;
	totalPages: number;
	initialPage: number;
}

const SAMPLES: Sample[] = [
	{ id: "few", caption: "5 页：页数少，没有省略号", totalPages: 5, initialPage: 3 },
	{ id: "middle", caption: "20 页：中段，两侧省略号", totalPages: 20, initialPage: 10 },
	{ id: "first", caption: "20 页：首页，上一页不可用", totalPages: 20, initialPage: 1 },
	{ id: "last", caption: "20 页：末页，下一页不可用", totalPages: 20, initialPage: 20 },
	{ id: "single", caption: "1 页：只有一页", totalPages: 1, initialPage: 1 },
];

function SampleRow({ sample }: { sample: Sample }) {
	const [page, setPage] = useState(sample.initialPage);
	return (
		<div className="flex flex-col gap-2">
			<span className="text-12 text-muted-foreground">{sample.caption}</span>
			{sample.totalPages > 1 ? (
				<Pagination
					aria-label={sample.caption}
					page={page}
					totalPages={sample.totalPages}
					onPageChange={setPage}
				/>
			) : (
				<p className="m-0 text-13 text-muted-foreground">
					总页数不超过 1 时，分页不渲染，页脚里不留空位。
				</p>
			)}
		</div>
	);
}

function PaginationFamily({ state }: ExhibitRenderProps) {
	const samples = SAMPLES.filter((sample) => state === "family" || sample.id === state);
	return (
		<div className="flex size-full flex-col justify-center gap-4 px-6">
			{samples.map((sample) => (
				<SampleRow key={`${state}-${sample.id}`} sample={sample} />
			))}
		</div>
	);
}

export const paginationExhibit: Exhibit = {
	id: "pagination",
	name: "分页",
	units: ["pagination"],
	zone: "shelf",
	category: "navigation",
	footprint: { width: 400, height: 360 },
	states: [
		{ id: "family", label: "全部" },
		{ id: "few", label: "页数少" },
		{ id: "middle", label: "中段" },
		{ id: "first", label: "首页" },
		{ id: "last", label: "末页" },
		{ id: "single", label: "只有一页" },
	],
	Render: PaginationFamily,
};

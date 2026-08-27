import type { SeriesSurface, SeriesVariant } from "@features/lab/series/model/mock";
import { EditorialVariant } from "@features/lab/series/ui/EditorialVariant";
import { SurfaceNav, VariantSwitcher } from "@features/lab/series/ui/PrototypeChrome";
import { ReaderAppVariant } from "@features/lab/series/ui/ReaderAppVariant";
import { TechBookVariant } from "@features/lab/series/ui/TechBookVariant";
import { LabHeader } from "@features/lab/ui/LabHeader";
import { createFileRoute } from "@tanstack/react-router";

interface SeriesLabSearch {
	variant: SeriesVariant;
	surface: SeriesSurface;
}

const isVariant = (value: unknown): value is SeriesVariant =>
	value === "A" || value === "B" || value === "C";
const isSurface = (value: unknown): value is SeriesSurface =>
	value === "shelf" || value === "detail" || value === "reader";

function parseSearch(search: Record<string, unknown>): SeriesLabSearch {
	return {
		variant: isVariant(search.variant) ? search.variant : "A",
		surface: isSurface(search.surface) ? search.surface : "shelf",
	};
}

/**
 * /lab/series - 在线书籍完整体验原型（issue #268）
 *
 * 三套结构差异明显的完整体验，均覆盖书架、书籍页与阅读器；
 * query 参数可分享当前组合。A=阅读应用，B=技术书，C=编辑出版。
 */
function SeriesLab() {
	const search = Route.useSearch();
	const navigate = Route.useNavigate();
	const setSearch = (next: Partial<SeriesLabSearch>) =>
		navigate({
			search: (previous) => ({ ...previous, ...next }),
			replace: true,
		});

	return (
		<div className="container mx-auto px-4 py-4 md:px-6">
			<LabHeader to="/lab/series" />
			<SurfaceNav current={search.surface} onChange={(surface) => setSearch({ surface })} />
			{search.variant === "A" ? <ReaderAppVariant surface={search.surface} /> : null}
			{search.variant === "B" ? <TechBookVariant surface={search.surface} /> : null}
			{search.variant === "C" ? <EditorialVariant surface={search.surface} /> : null}
			<VariantSwitcher
				current={search.variant}
				onChange={(variant) => setSearch({ variant })}
			/>
		</div>
	);
}

export const Route = createFileRoute("/lab/series")({
	validateSearch: parseSearch,
	component: SeriesLab,
});

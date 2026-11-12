import { renderedTheme } from "@shared/lib/theme-preference";
import { useRouteContext } from "@tanstack/react-router";
import { Segmented } from "@violet/ui";
import { useEffect, useRef } from "react";
import { CATEGORIES, type Category } from "../model/category";
import { caseColumnWidth, exhibitStatus, ZONES } from "../model/exhibit";
import type { ShowcaseSearch } from "../model/search";
import { ExhibitCase } from "./ExhibitCase";
import { EXHIBITS } from "./exhibits";
import { Inspector } from "./Inspector";
import { ShowcaseScope } from "./ShowcaseScope";
import { ShowcaseToolbar } from "./ShowcaseToolbar";

const COLUMN_WIDTH = caseColumnWidth(EXHIBITS);
const NUMBER = new Map(EXHIBITS.map((exhibit, index) => [exhibit.id, index + 1]));
const ON_VIEW = EXHIBITS.filter((exhibit) => exhibitStatus(exhibit) !== "planned").length;

const CATEGORY_SEGMENTS = [
	{ value: "all", label: "全部" },
	...CATEGORIES.map(({ id, name }) => ({ value: id, label: name })),
];

export interface ShowcasePageProps {
	search: ShowcaseSearch;
	onChange: (patch: Partial<ShowcaseSearch>) => void;
}

/**
 * 组件陈列室：按占地分五间展厅陈列真实组件，铭牌进入检视台。
 */
export function ShowcasePage({ search, onChange }: ShowcasePageProps) {
	const { theme, appearance } = useRouteContext({ from: "__root__" });
	const site = renderedTheme(theme);
	const mode = search.mode ?? appearance;
	const scope = {
		theme: search.season ?? site,
		mode,
		reduced: search.reduced ?? false,
	};
	const season = search.season ?? (site === "custom" ? "" : site);
	const outline = search.outline ?? false;
	const visible = EXHIBITS.filter(
		(exhibit) => search.category === undefined || exhibit.category === search.category,
	);
	const index = visible.findIndex((exhibit) => exhibit.id === search.open);
	const open = index >= 0 ? visible[index] : undefined;

	// 离开检视台后把焦点还给这件展品的铭牌
	const lastOpen = useRef<string | undefined>(undefined);
	useEffect(() => {
		if (open) {
			lastOpen.current = open.id;
			return;
		}
		const id = lastOpen.current;
		lastOpen.current = undefined;
		if (!id) return;
		const plinth = document.querySelector<HTMLElement>(
			`[data-exhibit="${CSS.escape(id)}"] [data-plinth]`,
		);
		plinth?.focus({ preventScroll: true });
		plinth?.scrollIntoView({ block: "nearest" });
	}, [open]);

	return (
		<ShowcaseScope appearance={scope} className="flex-1">
			<div className="px-5 pt-12 pb-32 sm:px-10 2xl:px-16">
				<header className="mb-14 border-b border-rule2 pb-8">
					<p className="font-mono text-12 tracking-[0.3em] text-muted-foreground uppercase">
						Violet UED · 馆藏目录
					</p>
					<h1 className="mt-3 text-36 font-normal sm:text-60">组件陈列室</h1>
					<p className="mt-4 max-w-150 text-13 text-muted-foreground">
						共 {EXHIBITS.length} 件展品，{ON_VIEW}{" "}
						件已上架，其余留着占地等组件落地。展品是真实组件，可以直接操作；点铭牌走近，切换状态、明暗与季节。
					</p>
					<ShowcaseToolbar
						className="mt-6"
						season={season}
						mode={mode}
						outline={outline}
						reduced={scope.reduced}
						onChange={onChange}
					/>
					<div className="-m-1 mt-3 overflow-x-auto p-1">
						<Segmented
							aria-label="用途"
							size="sm"
							value={search.category ?? "all"}
							onValueChange={(value) =>
								onChange({
									category: value === "all" ? undefined : (value as Category),
								})
							}
							segments={CATEGORY_SEGMENTS}
						/>
					</div>
				</header>
				{ZONES.map((zone, zoneIndex) => {
					const exhibits = visible.filter((exhibit) => exhibit.zone === zone.id);
					if (exhibits.length === 0) return null;
					const headingId = `zone-${zone.id}`;
					return (
						<section key={zone.id} aria-labelledby={headingId} className="mb-20">
							<div className="mb-8 flex flex-wrap items-end justify-between gap-2 border-b border-border pb-3">
								<h2 id={headingId} className="text-28 font-normal">
									<span className="mr-3 font-mono text-14 text-muted-foreground">
										第 {zoneIndex + 1} 展厅
									</span>
									{zone.name}
								</h2>
								<p className="text-13 text-muted-foreground">{zone.rule}</p>
							</div>
							<div
								data-hall={zone.id}
								className="grid items-end gap-x-10 gap-y-12"
								style={{
									gridTemplateColumns: `repeat(auto-fill, minmax(min(100%, ${COLUMN_WIDTH}px), 1fr))`,
								}}
							>
								{exhibits.map((exhibit) => (
									<ExhibitCase
										key={exhibit.id}
										exhibit={exhibit}
										number={NUMBER.get(exhibit.id) ?? 0}
										total={EXHIBITS.length}
										outline={outline}
										onOpen={() => onChange({ open: exhibit.id })}
									/>
								))}
							</div>
						</section>
					);
				})}
			</div>
			{open && (
				<Inspector
					exhibit={open}
					number={NUMBER.get(open.id) ?? 0}
					total={EXHIBITS.length}
					appearance={scope}
					season={season}
					outline={outline}
					onChange={onChange}
					onStep={(offset) =>
						onChange({
							open: visible[(index + offset + visible.length) % visible.length].id,
						})
					}
					onClose={() => onChange({ open: undefined })}
				/>
			)}
		</ShowcaseScope>
	);
}

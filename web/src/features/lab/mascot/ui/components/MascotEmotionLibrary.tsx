import type { EmotionDef } from "@violet/mascot";
import { Grid2X2 } from "lucide-react";
import { useState } from "react";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/shared/ui/base/dialog";
import { OverlayScroll } from "@/shared/ui/overlay-scroll";
import { SearchInput } from "@/shared/ui/search-input";
import { Segmented } from "@/shared/ui/segmented";
import type { MascotGroupFilter } from "../hooks/useMascotExhibit";
import { EmotionGridItem } from "./EmotionGridItem";

const GROUP_FILTERS: Array<{ value: MascotGroupFilter; label: string }> = [
	{ value: "all", label: "全部" },
	{ value: "emotion", label: "情绪" },
	{ value: "lifecycle", label: "日常" },
	{ value: "agent", label: "工作" },
];

/** 吉祥物状态库的筛选、搜索与选择契约。 */
export interface MascotEmotionLibraryProps {
	group: MascotGroupFilter;
	groupList: EmotionDef[];
	activeId: string;
	onSelectGroup: (group: MascotGroupFilter) => void;
	onSelectEmotion: (id: string) => void;
}

interface LibraryFiltersProps {
	group: MascotGroupFilter;
	query: string;
	visibleCount: number;
	totalCount: number;
	onSelectGroup: (group: MascotGroupFilter) => void;
	onQueryChange: (query: string) => void;
}

function LibraryFilters({
	group,
	query,
	visibleCount,
	totalCount,
	onSelectGroup,
	onQueryChange,
}: LibraryFiltersProps) {
	return (
		<>
			<div className="flex items-center justify-between gap-3">
				<Segmented
					value={group}
					onValueChange={onSelectGroup}
					segments={GROUP_FILTERS}
					block
					className="min-w-0 flex-1 font-mono text-[9px] tracking-[0.08em]"
				/>
				<p className="shrink-0 font-mono text-[9px] tabular-nums text-muted-foreground">
					{visibleCount}/{totalCount}
				</p>
			</div>

			<SearchInput
				value={query}
				onValueChange={onQueryChange}
				placeholder="搜索表情、状态或编号"
				aria-label="搜索表情、状态或编号"
				className="mt-2.5"
			/>
		</>
	);
}

/** 可搜索的表情联系表，让状态发现与舞台预览保持在同一视口。 */
export function MascotEmotionLibrary({
	group,
	groupList,
	activeId,
	onSelectGroup,
	onSelectEmotion,
}: MascotEmotionLibraryProps) {
	const [query, setQuery] = useState("");
	const [browserOpen, setBrowserOpen] = useState(false);
	const needle = query.trim().toLocaleLowerCase();
	const visibleDefs = needle
		? groupList.filter((def) =>
				[def.id, def.name, def.en, def.desc].some((field) =>
					field.toLocaleLowerCase().includes(needle),
				),
			)
		: groupList;

	const selectFromBrowser = (id: string) => {
		onSelectEmotion(id);
		setBrowserOpen(false);
	};

	return (
		<div className="flex h-full min-h-0 flex-col">
			<div className="hidden px-4 pt-4 pb-3 lg:block">
				<div className="mb-3 flex items-end justify-between gap-3">
					<div>
						<p className="font-mono text-[9px] tracking-[0.2em] text-muted-foreground uppercase">
							Expression library
						</p>
						<h2 className="mt-1 text-lg font-semibold tracking-tight">状态图鉴</h2>
					</div>
					<span className="font-mono text-[10px] text-neon-blue">#{activeId}</span>
				</div>
				<LibraryFilters
					group={group}
					query={query}
					visibleCount={visibleDefs.length}
					totalCount={groupList.length}
					onSelectGroup={onSelectGroup}
					onQueryChange={setQuery}
				/>
			</div>

			<OverlayScroll data-emotion-scroll className="hidden min-h-0 flex-1 lg:block">
				<div className="px-3 pb-3">
					<div className="grid grid-cols-2 border-t border-l border-edge-hairline">
						{visibleDefs.map((def) => (
							<EmotionGridItem
								key={def.id}
								def={def}
								active={def.id === activeId}
								onSelect={onSelectEmotion}
							/>
						))}
						{visibleDefs.length === 0 ? (
							<div className="col-span-2 flex min-h-52 flex-col items-center justify-center border-r border-b border-edge-hairline px-5 text-center">
								<p className="text-sm font-medium">没有匹配的状态</p>
								<button
									type="button"
									onClick={() => setQuery("")}
									className="mt-3 cursor-pointer font-mono text-[9px] tracking-[0.12em] text-neon-blue uppercase focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-neon-blue"
								>
									Clear query
								</button>
							</div>
						) : null}
					</div>
				</div>
			</OverlayScroll>

			<div className="min-h-0 lg:hidden">
				<div className="flex items-center justify-between gap-3 border-b border-edge-hairline px-3 py-2.5">
					<div>
						<p className="font-mono text-[9px] tracking-[0.16em] text-muted-foreground uppercase">
							Expression reel
						</p>
						<p className="mt-0.5 text-xs font-semibold">状态胶片</p>
					</div>

					<Dialog open={browserOpen} onOpenChange={setBrowserOpen}>
						<DialogTrigger asChild>
							<button
								type="button"
								className="inline-flex h-8 cursor-pointer items-center gap-1.5 border border-edge-hairline px-3 font-mono text-[9px] tracking-[0.08em] text-muted-foreground uppercase transition-colors hover:border-neon-blue hover:text-neon-blue focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-blue"
							>
								<Grid2X2 className="size-3.5" />
								全部状态
							</button>
						</DialogTrigger>
						<DialogContent className="max-h-[82dvh] gap-0! overflow-hidden rounded-lg border-edge-hairline bg-background p-0! text-foreground shadow-xl sm:max-w-2xl">
							<DialogHeader className="border-b border-edge-hairline px-4 pt-4 pr-12 pb-3 text-left">
								<DialogTitle className="text-lg tracking-tight">
									状态图鉴
								</DialogTitle>
								<DialogDescription className="text-xs text-muted-foreground">
									搜索并选择状态，关闭后舞台立即呈现结果。
								</DialogDescription>
							</DialogHeader>
							<div className="px-4 py-3">
								<LibraryFilters
									group={group}
									query={query}
									visibleCount={visibleDefs.length}
									totalCount={groupList.length}
									onSelectGroup={onSelectGroup}
									onQueryChange={setQuery}
								/>
							</div>
							<OverlayScroll data-emotion-scroll className="min-h-0">
								<div className="px-4 pb-4">
									<div className="grid grid-cols-2 border-t border-l border-edge-hairline sm:grid-cols-3">
										{visibleDefs.map((def) => (
											<EmotionGridItem
												key={def.id}
												def={def}
												active={def.id === activeId}
												onSelect={selectFromBrowser}
											/>
										))}
										{visibleDefs.length === 0 ? (
											<div className="col-span-2 flex min-h-44 flex-col items-center justify-center border-r border-b border-edge-hairline px-5 text-center sm:col-span-3">
												<p className="text-sm font-medium">
													没有匹配的状态
												</p>
												<button
													type="button"
													onClick={() => setQuery("")}
													className="mt-3 cursor-pointer font-mono text-[9px] tracking-[0.12em] text-neon-blue uppercase focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-neon-blue"
												>
													Clear query
												</button>
											</div>
										) : null}
									</div>
								</div>
							</OverlayScroll>
						</DialogContent>
					</Dialog>
				</div>

				<OverlayScroll data-emotion-scroll>
					<div className="p-3">
						<div className="flex w-max gap-2" role="group" aria-label="状态胶片">
							{visibleDefs.map((def) => (
								<EmotionGridItem
									key={def.id}
									def={def}
									active={def.id === activeId}
									onSelect={onSelectEmotion}
									variant="rail"
								/>
							))}
							{visibleDefs.length === 0 ? (
								<div className="flex h-26 w-64 items-center justify-center border border-edge-hairline px-4 text-center text-xs text-muted-foreground">
									没有匹配的状态，请打开完整图鉴清空搜索。
								</div>
							) : null}
						</div>
					</div>
				</OverlayScroll>
			</div>
		</div>
	);
}

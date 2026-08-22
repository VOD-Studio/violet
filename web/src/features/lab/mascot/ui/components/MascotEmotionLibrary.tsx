import type { EmotionDef } from "@violet/mascot";
import { Search, X } from "lucide-react";
import { useState } from "react";
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

/** 可搜索的表情联系表，让状态发现与舞台预览保持在同一视口。 */
export function MascotEmotionLibrary({
	group,
	groupList,
	activeId,
	onSelectGroup,
	onSelectEmotion,
}: MascotEmotionLibraryProps) {
	const [query, setQuery] = useState("");
	const needle = query.trim().toLocaleLowerCase();
	const visibleDefs = needle
		? groupList.filter((def) =>
				[def.id, def.name, def.en, def.desc].some((field) =>
					field.toLocaleLowerCase().includes(needle),
				),
			)
		: groupList;

	return (
		<aside className="order-2 flex min-h-0 flex-col border-2 border-[#11110f] bg-[#f8f9f5] lg:order-1 lg:h-147">
			<header className="border-b-2 border-[#11110f] p-3">
				<div className="flex items-end justify-between gap-3">
					<div>
						<p className="font-mono text-[10px] font-semibold tracking-[0.16em] text-[#11110f]/55">
							Expression library
						</p>
						<h2 className="mt-1 text-xl font-black tracking-[-0.04em]">状态库</h2>
					</div>
					<p className="font-mono text-xs font-semibold tabular-nums">
						{visibleDefs.length}/{groupList.length}
					</p>
				</div>

				<div className="mt-3 grid grid-cols-4 border border-[#11110f]">
					{GROUP_FILTERS.map((filter, index) => (
						<button
							key={filter.value}
							type="button"
							onClick={() => onSelectGroup(filter.value)}
							aria-pressed={group === filter.value}
							className={`h-8 cursor-pointer border-[#11110f] text-[11px] font-semibold transition-[background-color,box-shadow] focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--mascot-accent) focus-visible:ring-inset ${index > 0 ? "border-l" : ""} ${
								group === filter.value
									? "bg-[#e9e5de] text-[#11110f] shadow-[inset_0_-2px_0_var(--mascot-accent)]"
									: "bg-transparent text-[#11110f] hover:bg-[#eceee9]"
							}`}
						>
							{filter.label}
						</button>
					))}
				</div>

				<label className="relative mt-2 block">
					<Search
						aria-hidden
						className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2"
					/>
					<input
						type="search"
						value={query}
						onChange={(event) => setQuery(event.target.value)}
						placeholder="搜索表情、状态或编号"
						className="h-9 w-full border border-[#11110f] bg-white pr-9 pl-8 text-xs text-[#11110f] outline-none placeholder:text-[#11110f]/40 focus:border-(--mascot-accent) focus:ring-1 focus:ring-(--mascot-accent)"
					/>
					{query ? (
						<button
							type="button"
							onClick={() => setQuery("")}
							aria-label="清空搜索"
							className="absolute top-1/2 right-1.5 inline-flex size-6 -translate-y-1/2 cursor-pointer items-center justify-center transition-colors hover:bg-[#eceee9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--mascot-accent) focus-visible:ring-inset"
						>
							<X className="size-3.5" />
						</button>
					) : null}
				</label>
			</header>

			<div className="min-h-0 flex-1 overflow-y-auto bg-[#11110f]">
				<div className="grid grid-cols-2 gap-px">
					{visibleDefs.map((def) => (
						<EmotionGridItem
							key={def.id}
							def={def}
							active={def.id === activeId}
							onSelect={onSelectEmotion}
						/>
					))}
					{visibleDefs.length === 0 ? (
						<div className="col-span-2 flex min-h-52 flex-col items-center justify-center bg-[#f8f9f5] px-5 text-center">
							<p className="text-sm font-semibold">没有匹配的状态</p>
							<button
								type="button"
								onClick={() => setQuery("")}
								className="mt-3 cursor-pointer border-b border-[#11110f] text-xs font-medium hover:border-(--mascot-accent) hover:text-(--mascot-accent) focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-(--mascot-accent)"
							>
								清空关键词
							</button>
						</div>
					) : null}
				</div>
			</div>
		</aside>
	);
}

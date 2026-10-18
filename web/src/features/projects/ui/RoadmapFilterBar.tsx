import { useHasPermission } from "@features/auth/hooks/usePermissions";
import {
	Button,
	Input,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@violet/ui";
import { Search } from "lucide-react";
import { type ReactNode, useMemo } from "react";
import type { RoadmapFilters } from "../lib/roadmap-filter";
import type { RoadmapItem } from "../model/roadmap";

/** 筛选控件及全项目匹配统计；完成阶段的预览截断不参与计数。 */
export interface RoadmapFilterBarProps {
	items: readonly RoadmapItem[];
	filters: RoadmapFilters;
	onFiltersChange: (filters: RoadmapFilters) => void;
	filter?: (item: RoadmapItem) => boolean;
	includesCollapsed: boolean;
	/** 与筛选同一行、靠右的附加控件，例如画布的连线开关。 */
	trailing?: ReactNode;
}

/** 即时搜索与单标签组合筛选；结果总数包含尚未展开的条目。 */
export function RoadmapFilterBar({
	items,
	filters,
	onFiltersChange,
	filter,
	includesCollapsed,
	trailing,
}: RoadmapFilterBarProps) {
	const canUpdate = useHasPermission("project:update");
	const tags = useMemo(() => [...new Set(items.flatMap((item) => item.tags))], [items]);
	const selectedTag = filters.tag;
	// URL 中的标签可能已被删除，仍保留为选项，避免控件显示“全部”而看板仍在筛选。
	const options = selectedTag && !tags.includes(selectedTag) ? [...tags, selectedTag] : tags;
	const matched = filter
		? items.reduce((count, item) => count + (filter(item) ? 1 : 0), 0)
		: items.length;

	return (
		<section
			aria-label="路线图筛选"
			className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2"
		>
			<Input
				type="search"
				aria-label="搜索条目"
				placeholder="搜索标题或简介"
				variant="soft"
				controlSize="sm"
				classNames={{ root: "min-w-0 flex-[1_1_16rem] sm:max-w-80" }}
				leading={<Search className="size-4" aria-hidden="true" />}
				clearable
				value={filters.q ?? ""}
				onChange={(event) =>
					onFiltersChange({ ...filters, q: event.target.value || undefined })
				}
			/>
			<Select
				value={selectedTag ? `tag:${selectedTag}` : "all"}
				onValueChange={(value) =>
					onFiltersChange({
						...filters,
						tag: value === "all" ? undefined : value.slice(4),
					})
				}
			>
				<SelectTrigger
					aria-label="条目标签筛选"
					size="sm"
					className="max-w-full border-transparent bg-muted/50 shadow-none"
				>
					<SelectValue />
				</SelectTrigger>
				<SelectContent
					className="animate-none!"
					style={{ boxShadow: "0 4px 24px rgb(0 0 0 / 0.05)" }}
				>
					<SelectItem value="all">全部标签</SelectItem>
					{options.map((tag) => (
						<SelectItem key={tag} value={`tag:${tag}`}>
							{tag}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
			{filter ? (
				<Button type="button" variant="ghost" size="sm" onClick={() => onFiltersChange({})}>
					清除筛选
				</Button>
			) : null}
			<p role="status" className="min-w-0 flex-1 basis-48 text-sm text-muted-foreground">
				匹配 {matched} / {items.length} 条{includesCollapsed ? "（包含收起条目）" : ""}
				{filter ? (
					<span className="ml-3 inline-block">
						{canUpdate
							? "筛选生效中，不能拖动卡片。清除筛选后再试。"
							: "不匹配的条目已淡化，位置保持不变"}
					</span>
				) : null}
			</p>
			{trailing}
		</section>
	);
}

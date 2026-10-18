import { Empty, PageShell, ShimmerSkeleton } from "@violet/ui";
import { useHistoryShortcuts } from "@violetjs/kanban/unstyled";
import { useRef, useState } from "react";
import { useProjectRoadmap } from "../api/queries";
import { useCanEditRoadmap } from "../hooks/useCanEditRoadmap";
import { useRoadmapEditor } from "../hooks/useRoadmapEditor";
import type { RoadmapFilters } from "../lib/roadmap-filter";
import type { RoadmapDetail, RoadmapItem } from "../model/roadmap";
import { ProjectDetailHeader } from "./ProjectDetailHeader";
import { RoadmapBoard } from "./RoadmapBoard";
import { RoadmapItemDialog } from "./RoadmapItemDialog";

export interface ProjectDetailPageProps {
	slug: string;
	/** 路由 loader 取到的路线图，作为首帧数据，水合时才与直出的 HTML 一致。 */
	initialData?: RoadmapDetail;
	filters: RoadmapFilters;
	onFiltersChange: (filters: RoadmapFilters) => void;
}

/** 项目详情页：头部加只读路线图；数据由路由 loader 预取，窗口重新聚焦时更新。 */
export function ProjectDetailPage({
	slug,
	initialData,
	filters,
	onFiltersChange,
}: ProjectDetailPageProps) {
	const { data } = useProjectRoadmap(slug, initialData);
	// 只有能更新项目的人才能编辑；后端同样按 project:update 拒绝
	const canEdit = useCanEditRoadmap();
	const editor = useRoadmapEditor(slug, data);
	// Ctrl/⌘+Z 撤销、Ctrl/⌘+Shift+Z 重做；输入框里的按键留给输入框
	useHistoryShortcuts(editor.history, { enabled: canEdit });
	const [openId, setOpenId] = useState<string | null>(null);
	const opener = useRef<HTMLElement | null>(null);
	// 条目随重新拉取更新；被删除时弹窗随之关闭，淡出期间沿用最后一次的内容
	const lastItem = useRef<RoadmapItem | null>(null);
	const openItem =
		openId === null ? null : (data?.items.find((item) => item.id === openId) ?? null);
	if (openItem) lastItem.current = openItem;

	if (!data) {
		return (
			<PageShell>
				<div className="space-y-4">
					<ShimmerSkeleton className="h-10 w-1/2 rounded-lg" />
					<ShimmerSkeleton className="h-4 w-2/3 rounded-md" />
					<ShimmerSkeleton className="h-96 w-full rounded-lg" />
				</div>
			</PageShell>
		);
	}

	return (
		<PageShell>
			<ProjectDetailHeader project={data.project} progress={data.progress} />
			{data.items.length === 0 ? (
				<Empty
					title="暂无条目"
					description="这个项目还没有路线图条目"
					className="py-20"
					size="lg"
				/>
			) : (
				<RoadmapBoard
					items={data.items}
					relations={data.relations}
					filters={filters}
					onFiltersChange={onFiltersChange}
					onMove={canEdit ? editor.move : undefined}
					history={canEdit ? editor.history : undefined}
					onAddItem={canEdit ? editor.add : undefined}
					onOpenItem={(item, trigger) => {
						opener.current = trigger;
						setOpenId(item.id);
					}}
				/>
			)}
			<RoadmapItemDialog
				item={openItem ?? lastItem.current}
				items={data.items}
				relations={data.relations}
				open={openItem !== null}
				returnFocusTo={() => opener.current}
				onOpenChange={(open) => {
					if (!open) setOpenId(null);
				}}
			/>
		</PageShell>
	);
}

import type { ArticleEmbedPickerProps } from "@shared/ui/article-embeds";
import { useQuery } from "@tanstack/react-query";
import {
	Label,
	Segmented,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@violet/ui";
import { useEffect, useId, useState } from "react";
import { roadmapEmbedQueryOptions, useProjects } from "../api/queries";
import {
	type RoadmapEmbedChoice,
	type RoadmapEmbedShape,
	roadmapEmbedChoice,
	roadmapEmbedSource,
} from "./roadmap-embed-config";

/** Select 不接受空串作选项值，「不指定条目」用它代替。 */
const NO_ITEM = "none";

const SHAPES: { value: RoadmapEmbedShape; label: string }[] = [
	{ value: "card", label: "卡片" },
	{ value: "board", label: "看板画布" },
	{ value: "graph", label: "关系画布" },
];

const ITEM_HINTS: Record<RoadmapEmbedShape, string> = {
	card: "不指定条目时是项目卡片",
	board: "看板画布总是整个项目",
	graph: "指定条目时只画与它相连的部分，否则画整个项目",
};

/** 编辑器里插入 `roadmap` 围栏块：选项目、形态与条目，不手写 JSON。 */
export function RoadmapEmbedPicker({ initialSource, onChange }: ArticleEmbedPickerProps) {
	const [choice, setChoice] = useState<RoadmapEmbedChoice>(
		() =>
			(initialSource === undefined ? null : roadmapEmbedChoice(initialSource)) ?? {
				project: "",
				shape: "card",
			},
	);
	const projectId = useId();
	const itemId = useId();
	const projects = useProjects();
	const roadmap = useQuery({
		...roadmapEmbedQueryOptions(choice.project),
		enabled: choice.project !== "",
	});
	const items = roadmap.data?.status === "ok" ? roadmap.data.detail.items : [];
	const source = choice.project ? roadmapEmbedSource(choice) : null;

	useEffect(() => onChange(source), [source, onChange]);

	return (
		<div className="grid gap-4 sm:grid-cols-2">
			<div className="space-y-1.5">
				<Label htmlFor={projectId}>项目</Label>
				<Select
					value={choice.project}
					onValueChange={(project) => setChoice({ ...choice, project, item: undefined })}
					disabled={!projects.data}
				>
					<SelectTrigger id={projectId} className="w-full">
						<SelectValue
							placeholder={projects.isError ? "项目列表读取失败" : "选择项目"}
						/>
					</SelectTrigger>
					<SelectContent>
						{(projects.data ?? []).map((project) => (
							<SelectItem key={project.id} value={project.slug}>
								{project.title}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				{projects.data?.length === 0 ? (
					<p className="text-xs text-muted-foreground">还没有项目</p>
				) : null}
			</div>
			<div className="space-y-1.5">
				{/* 分段控件是一组按钮，没有可关联的表单控件；用同样的标签样式，名称由 aria-label 给出 */}
				<Label asChild>
					<span>形态</span>
				</Label>
				<Segmented
					aria-label="形态"
					value={choice.shape}
					onValueChange={(shape) =>
						setChoice({
							...choice,
							shape,
							item: shape === "board" ? undefined : choice.item,
						})
					}
					segments={SHAPES}
					size="default"
					block
				/>
			</div>
			<div className="space-y-1.5 sm:col-span-2">
				<Label htmlFor={itemId}>条目</Label>
				<Select
					value={choice.item === undefined ? NO_ITEM : String(choice.item)}
					onValueChange={(value) =>
						setChoice({
							...choice,
							item: value === NO_ITEM ? undefined : Number(value),
						})
					}
					disabled={choice.shape === "board" || roadmap.data?.status !== "ok"}
				>
					<SelectTrigger id={itemId} className="w-full">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value={NO_ITEM}>不指定</SelectItem>
						{items.map((item) => (
							<SelectItem key={item.id} value={String(item.number)}>
								#{item.number} {item.title}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<p className="text-xs text-muted-foreground">
					{roadmap.data?.status === "missing"
						? "这个项目不存在或已删除"
						: roadmap.data?.status === "error"
							? "条目读取失败，请稍后再试"
							: ITEM_HINTS[choice.shape]}
				</p>
			</div>
		</div>
	);
}

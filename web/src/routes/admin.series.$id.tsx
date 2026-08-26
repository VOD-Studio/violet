import {
	closestCenter,
	DndContext,
	type DragEndEvent,
	KeyboardSensor,
	PointerSensor,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import {
	arrayMove,
	SortableContext,
	sortableKeyboardCoordinates,
	verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { PageShell } from "@features/admin-layout/ui/PageShell";
import {
	useAddSection,
	useAttachChapters,
	useDetachChapter,
	usePublishSeries,
	useRemoveSection,
	useReorderChapters,
	useReorderSections,
} from "@features/admin-series/api/mutations";
import { useAdminSeriesDetail } from "@features/admin-series/api/queries";
import type { SeriesChapterDTO, SeriesSectionChapters } from "@features/admin-series/model/types";
import { PostPickerDialog } from "@features/admin-series/ui/PostPickerDialog";
import { SeriesSheet } from "@features/admin-series/ui/SeriesSheet";
import { SortableChapterRow } from "@features/admin-series/ui/SortableChapterRow";
import { PermissionGuard } from "@features/auth/ui/PermissionGuard";
import { Button } from "@shared/ui/base/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@shared/ui/base/dialog";
import { Input } from "@shared/ui/base/input";
import { Skeleton } from "@shared/ui/base/skeleton";
import { ConfirmDialog } from "@shared/ui/confirm-dialog";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, BookPlus, Globe, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/admin/series/$id")({
	component: AdminSeriesEditPage,
});

function useDndSensors() {
	return useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
		useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
	);
}

function AdminSeriesEditPage() {
	const { id } = Route.useParams();
	const { data: series, isLoading } = useAdminSeriesDetail(id);
	const publish = usePublishSeries(id);
	const addSection = useAddSection(id);
	const removeSection = useRemoveSection(id);
	const reorderSections = useReorderSections(id);
	const attach = useAttachChapters(id);
	const detach = useDetachChapter(id);
	const reorder = useReorderChapters(id);
	const sensors = useDndSensors();

	const [metaOpen, setMetaOpen] = useState(false);
	// null=关；""=挂书根；其他=挂入对应卷
	const [pickerScope, setPickerScope] = useState<string | null>(null);
	const [sectionTitle, setSectionTitle] = useState("");
	const [addSectionOpen, setAddSectionOpen] = useState(false);
	const [removeSectionTarget, setRemoveSectionTarget] = useState<SeriesSectionChapters | null>(
		null,
	);
	const [detachTarget, setDetachTarget] = useState<SeriesChapterDTO | null>(null);

	// 书内全部章节 ID（选择器禁选依据，防重复挂章被后端拒绝）
	const inBookIds = useMemo(() => {
		const ids = new Set<string>();
		if (!series) return ids;
		for (const ch of series.root_chapters) ids.add(ch.post_id);
		for (const sec of series.sections) for (const ch of sec.chapters) ids.add(ch.post_id);
		return ids;
	}, [series]);

	if (isLoading || !series) {
		return (
			<div className="space-y-4 p-6">
				<Skeleton className="h-8 w-64" />
				<Skeleton className="h-40 w-full" />
				<Skeleton className="h-64 w-full" />
			</div>
		);
	}

	/** 卷拖拽结束：重排后全量提交卷顺序 */
	const onSectionDragEnd = (event: DragEndEvent) => {
		const { active, over } = event;
		if (!over || active.id === over.id) return;
		const oldIndex = series.sections.findIndex((s) => s.section.id === active.id);
		const newIndex = series.sections.findIndex((s) => s.section.id === over.id);
		if (oldIndex < 0 || newIndex < 0) return;
		const reordered = arrayMove(series.sections, oldIndex, newIndex);
		reorderSections.mutate(reordered.map((s) => s.section.id));
	};

	/** 章节拖拽（卷内/根范围各自独立 SortableContext）：
	 * 拖完以新序重算全树 plans 提交。跨卷移动走「摘除 + 挂入」两步（后端
	 * chapters/order 也支持跨卷，但 dnd 跨 Context 拖拽体验差，两步更明确）。 */
	const makeChapterDragEnd = (scopeId: string, chapters: SeriesChapterDTO[]) => {
		return (event: DragEndEvent) => {
			const { active, over } = event;
			if (!over || active.id === over.id) return;
			const oldIndex = chapters.findIndex((c) => c.post_id === active.id);
			const newIndex = chapters.findIndex((c) => c.post_id === over.id);
			if (oldIndex < 0 || newIndex < 0) return;
			const reordered = arrayMove(chapters, oldIndex, newIndex);
			const plans = [
				{ section_id: "", ordered_post_ids: series.root_chapters.map((c) => c.post_id) },
				...series.sections.map((s) => ({
					section_id: s.section.id,
					ordered_post_ids: s.chapters.map((c) => c.post_id),
				})),
			].map((plan) =>
				plan.section_id === scopeId
					? { ...plan, ordered_post_ids: reordered.map((c) => c.post_id) }
					: plan,
			);
			reorder.mutate(plans);
		};
	};

	const renderScope = (scopeId: string, label: string | null, chapters: SeriesChapterDTO[]) => {
		return (
			<div className="rounded-lg border border-edge-hairline p-4">
				<div className="mb-3 flex items-center justify-between">
					<h3 className="text-sm font-medium">{label ?? "书根章节（未分卷）"}</h3>
					<PermissionGuard permission="series:update">
						<div className="flex items-center gap-1">
							<Button
								size="sm"
								variant="outline"
								onClick={() => setPickerScope(scopeId)}
							>
								<BookPlus className="size-3.5" />
								挂入章节
							</Button>
							{label !== null && (
								<Button
									size="icon-sm"
									variant="ghost"
									title="删除卷（须先移出全部章节）"
									onClick={() => {
										const sec = series.sections.find(
											(s) => s.section.id === scopeId,
										);
										if (sec) setRemoveSectionTarget(sec);
									}}
								>
									<Trash2 className="size-3.5" />
								</Button>
							)}
						</div>
					</PermissionGuard>
				</div>
				{chapters.length === 0 ? (
					<p className="text-muted-foreground py-4 text-center text-sm">暂无章节</p>
				) : (
					<DndContext
						sensors={sensors}
						collisionDetection={closestCenter}
						onDragEnd={makeChapterDragEnd(scopeId, chapters)}
					>
						<SortableContext
							items={chapters.map((c) => c.post_id)}
							strategy={verticalListSortingStrategy}
						>
							<div className="space-y-1.5">
								{chapters.map((ch) => (
									<SortableChapterRow
										key={ch.post_id}
										chapter={ch}
										onRemove={(postId) => {
											const target = chapters.find(
												(c) => c.post_id === postId,
											);
											if (target) setDetachTarget(target);
										}}
									/>
								))}
							</div>
						</SortableContext>
					</DndContext>
				)}
			</div>
		);
	};

	return (
		<PageShell
			title={series.title}
			description={`slug: ${series.slug} · 章节 ${series.chapter_count} 已发布 / ${series.total_chapter_count} 总计`}
			action={
				<>
					<Button size="sm" variant="outline" asChild>
						<Link to="/admin/series">
							<ArrowLeft className="size-3.5" />
							返回书架
						</Link>
					</Button>
					<PermissionGuard permission="series:update">
						<Button size="sm" variant="outline" onClick={() => setMetaOpen(true)}>
							编辑信息
						</Button>
						<Button
							size="sm"
							variant={series.status === "published" ? "outline" : "default"}
							disabled={publish.isPending}
							onClick={() => publish.mutate(series.status !== "published")}
						>
							<Globe className="size-3.5" />
							{series.status === "published" ? "收回草稿" : "发布"}
						</Button>
					</PermissionGuard>
				</>
			}
		>
			<div className="space-y-4">
				{renderScope("", null, series.root_chapters)}
				<div>
					<div className="mb-3 flex items-center justify-between">
						<h2 className="text-sm font-semibold">卷 / 部</h2>
						<PermissionGuard permission="series:update">
							<Button
								size="sm"
								variant="outline"
								onClick={() => setAddSectionOpen(true)}
							>
								<Plus className="size-3.5" />
								新建卷
							</Button>
						</PermissionGuard>
					</div>
					<DndContext
						sensors={sensors}
						collisionDetection={closestCenter}
						onDragEnd={onSectionDragEnd}
					>
						<div className="space-y-4">
							{series.sections.map((sec) =>
								renderScope(sec.section.id, sec.section.title, sec.chapters),
							)}
						</div>
					</DndContext>
				</div>
			</div>

			<SeriesSheet open={metaOpen} onOpenChange={setMetaOpen} editing={series} />

			<Dialog open={addSectionOpen} onOpenChange={setAddSectionOpen}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>新建卷 / 部</DialogTitle>
						<DialogDescription>
							卷会排到末尾，可拖拽调整顺序；章节可挂入卷或直接挂书根。
						</DialogDescription>
					</DialogHeader>
					<Input
						value={sectionTitle}
						onChange={(e) => setSectionTitle(e.target.value)}
						placeholder="如：第一部 · 语言地基"
					/>
					<DialogFooter>
						<Button
							disabled={!sectionTitle.trim() || addSection.isPending}
							onClick={() =>
								addSection.mutate(sectionTitle.trim(), {
									onSuccess: () => {
										setSectionTitle("");
										setAddSectionOpen(false);
									},
								})
							}
						>
							创建
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<ConfirmDialog
				open={!!removeSectionTarget}
				onOpenChange={(v) => !v && setRemoveSectionTarget(null)}
				onConfirm={() => {
					if (!removeSectionTarget) return;
					removeSection.mutate(removeSectionTarget.section.id, {
						onSuccess: () => setRemoveSectionTarget(null),
					});
				}}
				title="确认删除卷"
				description={`删除《${removeSectionTarget?.section.title}》？卷内仍有章节时会被拒绝。`}
				confirmLabel="删除卷"
				loading={removeSection.isPending}
			/>

			<ConfirmDialog
				open={!!detachTarget}
				onOpenChange={(v) => !v && setDetachTarget(null)}
				onConfirm={() => {
					if (!detachTarget) return;
					detach.mutate(detachTarget.post_id, {
						onSuccess: () => setDetachTarget(null),
					});
				}}
				title="确认摘除章节"
				description={`把《${detachTarget?.title}》从书中摘除？文章本身不受影响，随时可重新挂入。`}
				confirmLabel="摘除"
				loading={detach.isPending}
			/>

			<PostPickerDialog
				open={pickerScope !== null}
				onOpenChange={(v) => !v && setPickerScope(null)}
				excludeIds={inBookIds}
				loading={attach.isPending}
				onConfirm={(posts) => {
					if (pickerScope === null) return;
					attach.mutate(
						{
							post_ids: posts.map((p) => p.id),
							section_id: pickerScope === "" ? "" : pickerScope,
						},
						{ onSuccess: () => setPickerScope(null) },
					);
				}}
			/>
		</PageShell>
	);
}

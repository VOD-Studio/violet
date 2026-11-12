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
import { SeriesChapterScope } from "@features/admin-series/ui/SeriesChapterScope";
import { SeriesSheet } from "@features/admin-series/ui/SeriesSheet";
import { PermissionGuard } from "@features/auth/ui/PermissionGuard";
import { HistoryBack } from "@shared/ui/history-back";
import { createFileRoute } from "@tanstack/react-router";
import {
	Button,
	ConfirmDialog,
	Dialog,
	DialogBody,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	Input,
	iconProps,
	Skeleton,
	Sortable,
} from "@violet/ui";
import { Globe, Plus } from "lucide-react";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/admin/series/$id")({
	component: AdminSeriesEditPage,
});

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

	const reorderScope = (scopeId: string, chapters: SeriesChapterDTO[]) => {
		const plans = [
			{
				section_id: "",
				ordered_post_ids: series.root_chapters.map((chapter) => chapter.post_id),
			},
			...series.sections.map((section) => ({
				section_id: section.section.id,
				ordered_post_ids: section.chapters.map((chapter) => chapter.post_id),
			})),
		].map((plan) =>
			plan.section_id === scopeId
				? { ...plan, ordered_post_ids: chapters.map((chapter) => chapter.post_id) }
				: plan,
		);
		return reorder.mutateAsync(plans);
	};

	const renderScope = (scopeId: string, label: string | null, chapters: SeriesChapterDTO[]) => (
		<SeriesChapterScope
			label={label}
			chapters={chapters}
			disabled={reorder.isPending}
			onAttach={() => setPickerScope(scopeId)}
			onDetach={setDetachTarget}
			onReorder={(ordered) => reorderScope(scopeId, ordered)}
			onRemoveSection={
				label === null
					? undefined
					: () => {
							const section = series.sections.find(
								(candidate) => candidate.section.id === scopeId,
							);
							if (section) setRemoveSectionTarget(section);
						}
			}
		/>
	);

	return (
		<PageShell
			title={series.title}
			description={`《${series.title}》 · 章节 ${series.chapter_count} 已发布 / ${series.total_chapter_count} 总计`}
			action={
				<>
					<HistoryBack
						fallbackTo="/admin/series"
						className="h-8 gap-2 rounded-md border border-input bg-background px-3 text-sm shadow-xs hover:bg-accent hover:text-accent-foreground"
					>
						返回书架
					</HistoryBack>
					<PermissionGuard permission="series:update">
						<Button size="sm" variant="outline" onClick={() => setMetaOpen(true)}>
							编辑信息
						</Button>
						<Button
							size="sm"
							variant={series.status === "published" ? "outline" : "primary"}
							disabled={publish.isPending}
							onClick={() => publish.mutate(series.status !== "published")}
						>
							<Globe {...iconProps(14)} />
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
								<Plus {...iconProps(14)} />
								新建卷
							</Button>
						</PermissionGuard>
					</div>
					<Sortable
						aria-label="卷与部顺序"
						items={series.sections}
						getId={(section) => section.section.id}
						getLabel={(section) => section.section.title}
						disabled={reorderSections.isPending}
						onReorder={(sections) =>
							reorderSections.mutateAsync(
								sections.map((section) => section.section.id),
							)
						}
						renderItem={(section) =>
							renderScope(section.section.id, section.section.title, section.chapters)
						}
					/>
				</div>
			</div>

			<SeriesSheet open={metaOpen} onOpenChange={setMetaOpen} editing={series} />

			<Dialog open={addSectionOpen} onOpenChange={setAddSectionOpen}>
				<DialogContent size="sm">
					<DialogHeader>
						<DialogTitle>新建卷 / 部</DialogTitle>
						<DialogDescription>
							卷会排到末尾，可拖拽调整顺序；章节可挂入卷或直接挂书根。
						</DialogDescription>
					</DialogHeader>
					<DialogBody>
						<Input
							aria-label="卷名"
							value={sectionTitle}
							onChange={(e) => setSectionTitle(e.target.value)}
							placeholder="如：第一部 · 语言地基"
						/>
					</DialogBody>
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

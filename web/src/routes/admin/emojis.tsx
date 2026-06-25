import { AddEmojiDialog } from "@features/admin-emojis/ui/AddEmojiDialog";
import { CreateEmojiGroupForm } from "@features/admin-emojis/ui/CreateEmojiGroupForm";
import { EmojiGrid } from "@features/admin-emojis/ui/EmojiGrid";
import { EmojiGroupItem } from "@features/admin-emojis/ui/EmojiGroupItem";
import { PageHeader } from "@features/admin-shared/ui/PageHeader";
import { useAllEmojiGroupsAdmin } from "@features/emojis/api/queries";
import { Button } from "@shared/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@shared/ui/dialog";
import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useEffect, useState } from "react";

/**
 * /admin/emojis - 表情管理
 *
 * 两栏布局：左分组列表，右选中分组的表情网格。
 * 分组列表接口已嵌套 emojis 数组，右栏零额外请求。
 */
export const Route = createFileRoute("/admin/emojis")({
	component: EmojisPage,
});

function EmojisPage() {
	const { data: groups, isLoading, error, refetch } = useAllEmojiGroupsAdmin();

	const [selectedId, setSelectedId] = useState<number | null>(null);
	const [groupDialogOpen, setGroupDialogOpen] = useState(false);
	const [emojiDialogOpen, setEmojiDialogOpen] = useState(false);

	// 默认选中第一个分组
	useEffect(() => {
		if (selectedId === null && groups && groups.length > 0) {
			setSelectedId(groups[0].id);
		}
		// 选中的分组被删后，回退到第一个
		if (
			selectedId !== null &&
			groups &&
			groups.length > 0 &&
			!groups.some((g) => g.id === selectedId)
		) {
			setSelectedId(groups[0].id);
		}
	}, [groups, selectedId]);

	const selected = groups?.find((g) => g.id === selectedId) ?? null;

	return (
		<div>
			<PageHeader title="表情管理" description="管理表情分组与表情图片" />

			{error ? (
				<p className="py-12 text-center text-sm text-destructive">加载失败：{error.message}</p>
			) : (
				<div className="grid gap-4 md:grid-cols-[240px_1fr]">
					{/* 左栏：分组列表 */}
					<div className="space-y-2">
						<div className="flex items-center justify-between">
							<h3 className="text-xs font-medium text-muted-foreground">分组</h3>
							<Dialog open={groupDialogOpen} onOpenChange={setGroupDialogOpen}>
								<DialogTrigger asChild>
									<Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
										<Plus className="size-3" /> 新建
									</Button>
								</DialogTrigger>
								<DialogContent>
									<CreateEmojiGroupForm
										onCreated={() => {
											setGroupDialogOpen(false);
											void refetch();
										}}
									/>
								</DialogContent>
							</Dialog>
						</div>

						{isLoading ? (
							<p className="py-8 text-center text-xs text-muted-foreground">加载中…</p>
						) : groups && groups.length > 0 ? (
							<div className="space-y-1.5">
								{groups.map((group) => (
									<EmojiGroupItem
										key={group.id}
										group={group}
										selected={group.id === selectedId}
										onSelect={() => setSelectedId(group.id)}
										onMutated={() => void refetch()}
									/>
								))}
							</div>
						) : (
							<p className="py-8 text-center text-xs text-muted-foreground">暂无分组</p>
						)}
					</div>

					{/* 右栏：选中分组的表情网格 */}
					<div className="rounded-md border border-border bg-card p-4">
						{selected ? (
							<>
								<div className="mb-4 flex items-center justify-between">
									<div>
										<h3 className="text-sm font-medium">{selected.name}</h3>
										<p className="text-xs text-muted-foreground">
											共 {selected.emojis.length} 个表情
										</p>
									</div>
									<Button size="sm" onClick={() => setEmojiDialogOpen(true)}>
										<Plus className="size-3.5" /> 添加表情
									</Button>
								</div>
								<EmojiGrid
									emojis={selected.emojis}
									groupId={selected.id}
									onMutated={() => void refetch()}
								/>
								<AddEmojiDialog
									open={emojiDialogOpen}
									onOpenChange={setEmojiDialogOpen}
									groupId={selected.id}
									onAdded={() => void refetch()}
								/>
							</>
						) : (
							<p className="py-12 text-center text-sm text-muted-foreground">
								选择左侧分组查看表情
							</p>
						)}
					</div>
				</div>
			)}
		</div>
	);
}

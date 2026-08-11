import type { EmojiGroup } from "@entities/emoji/model/types";
import {
	useBatchUpdateGroupStatus,
	useDeleteEmojiGroup,
} from "@features/admin-emojis/api/mutations";
import { useAllEmojiGroupsAdmin } from "@features/admin-emojis/api/queries";
import { EmojiGroupCard } from "@features/admin-emojis/ui/EmojiGroupCard";
import { EmojiGroupFormDialog } from "@features/admin-emojis/ui/EmojiGroupFormDialog";
import { EmojiManageDialog } from "@features/admin-emojis/ui/EmojiManageDialog";
import { GroupCardSkeleton } from "@features/admin-emojis/ui/GroupCardSkeleton";
import { RefetchBilibiliButton } from "@features/admin-emojis/ui/RefetchBilibiliButton";
import { StatsCard } from "@features/admin-emojis/ui/StatsCard";
import { StatsCardSkeleton } from "@features/admin-emojis/ui/StatsCardSkeleton";
import { PageShell } from "@features/admin-layout/ui/PageShell";
import { useHasPermission } from "@features/auth/hooks/usePermissions";
import { Badge } from "@shared/ui/base/badge";
import { Button } from "@shared/ui/base/button";
import { Card, CardContent } from "@shared/ui/base/card";
import { ConfirmDialog } from "@shared/ui/confirm-dialog";
import Empty from "@shared/ui/empty";
import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle, Layers, Loader2, Plus, Power, PowerOff } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { SearchInput } from "@/shared/ui/search-input";

/**
 * /admin/emojis - 表情管理
 *
 * 统计卡片 + 工具栏 + 分组卡片网格，支持分组 CRUD 与批量启停，
 * 管理分组内表情走弹窗。排版对齐 main，组件与数据层沿用当前架构。
 */
export const Route = createFileRoute("/admin/emojis")({
	component: EmojisPage,
});

function EmojisPage() {
	const { data: groups, isLoading, error, refetch } = useAllEmojiGroupsAdmin();
	const batchUpdateStatus = useBatchUpdateGroupStatus();

	const [searchQuery, setSearchQuery] = useState("");
	const [groupFormOpen, setGroupFormOpen] = useState(false);
	const [editingGroup, setEditingGroup] = useState<EmojiGroup | null>(null);
	const [deleteConfirm, setDeleteConfirm] = useState<{
		open: boolean;
		group: EmojiGroup | null;
	}>({ open: false, group: null });
	const [emojisOpen, setEmojisOpen] = useState(false);
	const [activeGroupId, setActiveGroupId] = useState(0);
	const activeGroup = groups?.find((g) => g.id === activeGroupId) ?? null;

	const deleteGroup = useDeleteEmojiGroup();

	const canManageGroup = useHasPermission("emoji:manage-group");
	const canCreateEmoji = useHasPermission("emoji:create");
	const canRefetch = useHasPermission("emoji:refetch");

	const stats = useMemo(() => {
		if (!groups) return { total: 0, enabled: 0, disabled: 0 };
		const enabled = groups.filter((g) => g.is_enabled).length;
		return {
			total: groups.length,
			enabled,
			disabled: groups.length - enabled,
		};
	}, [groups]);

	const filteredGroups = useMemo(() => {
		if (!groups) return [];
		if (!searchQuery.trim()) return groups;
		const query = searchQuery.toLowerCase();
		return groups.filter((g) => g.name.toLowerCase().includes(query));
	}, [groups, searchQuery]);

	function handleCreateGroup() {
		setEditingGroup(null);
		setGroupFormOpen(true);
	}

	function handleEditGroup(group: EmojiGroup) {
		setEditingGroup(group);
		setGroupFormOpen(true);
	}

	function handleDeleteGroup(group: EmojiGroup) {
		setDeleteConfirm({ open: true, group });
	}

	function confirmDeleteGroup() {
		if (!deleteConfirm.group) return;
		deleteGroup.mutate(
			{ id: deleteConfirm.group.id },
			{
				onSuccess: () => {
					toast.success("分组已删除");
					setDeleteConfirm({ open: false, group: null });
				},
				onError: (err) => {
					toast.error(err.message);
					setDeleteConfirm({ open: false, group: null });
				},
			},
		);
	}

	function handleManageEmojis(groupId: number) {
		setActiveGroupId(groupId);
		setEmojisOpen(true);
	}

	function handleBatchEnable() {
		if (!groups || groups.length === 0) return;
		const disabledIds = groups.filter((g) => !g.is_enabled).map((g) => g.id);
		if (disabledIds.length === 0) {
			toast.info("所有分组已启用");
			return;
		}
		batchUpdateStatus.mutate(
			{ ids: disabledIds, is_enabled: true },
			{
				onSuccess: () => toast.success(`已启用 ${disabledIds.length} 个分组`),
				onError: (err) => toast.error(err.message),
			},
		);
	}

	function handleBatchDisable() {
		if (!groups || groups.length === 0) return;
		const enabledIds = groups.filter((g) => g.is_enabled).map((g) => g.id);
		if (enabledIds.length === 0) {
			toast.info("所有分组已禁用");
			return;
		}
		batchUpdateStatus.mutate(
			{ ids: enabledIds, is_enabled: false },
			{
				onSuccess: () => toast.success(`已禁用 ${enabledIds.length} 个分组`),
				onError: (err) => toast.error(err.message),
			},
		);
	}

	const isEmpty = !isLoading && !error && (!groups || groups.length === 0);
	const isFilteredEmpty =
		!isLoading && !error && filteredGroups.length === 0 && !!groups && groups.length > 0;
	const batchPending = batchUpdateStatus.isPending;

	return (
		<PageShell
			title="表情管理"
			description="管理表情分组和表情"
			action={
				<div className="flex items-center gap-2">
					{canRefetch ? <RefetchBilibiliButton /> : null}
					{canManageGroup ? (
						<Button size="sm" onClick={handleCreateGroup}>
							<Plus className="size-3.5" />
							创建分组
						</Button>
					) : null}
				</div>
			}
			sticky={
				!isEmpty && (
					<div className="flex flex-wrap items-center gap-3 pt-1">
						<div className="min-w-50 max-w-100 flex-1">
							<SearchInput
								placeholder="搜索分组名称..."
								value={searchQuery}
								onValueChange={setSearchQuery}
							/>
						</div>

						<div className="flex items-center gap-2">
							{canManageGroup ? (
								<>
									<Button
										variant="outline"
										size="sm"
										onClick={handleBatchEnable}
										disabled={batchPending || isLoading || stats.disabled === 0}
									>
										{batchPending ? (
											<Loader2 className="mr-1 size-3.5 animate-spin" />
										) : (
											<Power className="mr-1 size-3.5" />
										)}
										批量启用
									</Button>
									<Button
										variant="outline"
										size="sm"
										onClick={handleBatchDisable}
										disabled={batchPending || isLoading || stats.enabled === 0}
									>
										{batchPending ? (
											<Loader2 className="mr-1 size-3.5 animate-spin" />
										) : (
											<PowerOff className="mr-1 size-3.5" />
										)}
										批量禁用
									</Button>
								</>
							) : null}
						</div>

						{searchQuery && (
							<Badge variant="secondary" className="ml-auto">
								显示 {filteredGroups.length} / {groups?.length ?? 0} 个分组
							</Badge>
						)}
					</div>
				)
			}
		>
			{/* 统计卡片 */}
			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{isLoading ? (
					<>
						<StatsCardSkeleton />
						<StatsCardSkeleton />
						<StatsCardSkeleton />
					</>
				) : (
					<>
						<StatsCard
							title="总分组数"
							value={stats.total}
							icon={<Layers className="size-5 text-muted-foreground" />}
						/>
						<StatsCard
							title="已启用"
							value={stats.enabled}
							icon={<CheckCircle className="size-5 text-green-500" />}
						/>
						<StatsCard
							title="已禁用"
							value={stats.disabled}
							icon={<Layers className="size-5 text-muted-foreground" />}
							className={stats.disabled > 0 ? "border-orange-200" : undefined}
						/>
					</>
				)}
			</div>

			{/* 加载态 */}
			{isLoading && (
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
					{["s1", "s2", "s3", "s4", "s5", "s6"].map((k) => (
						<GroupCardSkeleton key={k} />
					))}
				</div>
			)}

			{/* 错误态 */}
			{error && (
				<Card>
					<CardContent className="flex flex-col items-center gap-3 py-12">
						<p className="text-sm text-destructive">加载失败：{error.message}</p>
						<Button
							variant="outline"
							size="sm"
							onClick={() => refetch().catch(() => {})}
						>
							重试
						</Button>
					</CardContent>
				</Card>
			)}

			{/* 空数据态 */}
			{isEmpty && (
				<Empty
					title="NO GROUPS"
					description="创建第一个表情分组开始管理"
					action={
						canManageGroup ? (
							<Button onClick={handleCreateGroup}>
								<Plus className="mr-1 size-4" />
								创建分组
							</Button>
						) : null
					}
				/>
			)}

			{/* 搜索无结果 */}
			{isFilteredEmpty && (
				<Empty title="NO MATCH" description={`没有找到名称包含「${searchQuery}」的分组`} />
			)}

			{/* 分组卡片网格 */}
			{!isLoading && !error && filteredGroups.length > 0 && (
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
					{filteredGroups.map((group) => (
						<EmojiGroupCard
							key={group.id}
							group={group}
							onEdit={canManageGroup ? handleEditGroup : undefined}
							onDelete={canManageGroup ? handleDeleteGroup : undefined}
							onManageEmojis={canCreateEmoji ? handleManageEmojis : undefined}
						/>
					))}
				</div>
			)}

			{/* 创建/编辑分组弹窗 */}
			<EmojiGroupFormDialog
				open={groupFormOpen}
				onOpenChange={setGroupFormOpen}
				editingGroup={editingGroup}
				groupCount={groups?.length ?? 0}
			/>

			{/* 删除确认弹窗 */}
			<ConfirmDialog
				open={deleteConfirm.open}
				onOpenChange={(open: boolean) =>
					!open && setDeleteConfirm({ open: false, group: null })
				}
				title="删除表情分组"
				description={`确定要删除表情分组「${deleteConfirm.group?.name ?? ""}」吗？分组内所有表情也将被删除，此操作不可撤销。`}
				confirmLabel="删除"
				loading={deleteGroup.isPending}
				onConfirm={confirmDeleteGroup}
			/>

			{/* 表情管理弹窗 */}
			<EmojiManageDialog open={emojisOpen} onOpenChange={setEmojisOpen} group={activeGroup} />
		</PageShell>
	);
}

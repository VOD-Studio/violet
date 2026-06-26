import { EmojiGroupCard } from "@features/admin-emojis/ui/EmojiGroupCard";
import { EmojiGroupFormDialog } from "@features/admin-emojis/ui/EmojiGroupFormDialog";
import { EmojiManageDialog } from "@features/admin-emojis/ui/EmojiManageDialog";
import { GroupCardSkeleton } from "@features/admin-emojis/ui/GroupCardSkeleton";
import { ConfirmDialog } from "@features/admin-shared/ui/ConfirmDialog";
import { useBatchUpdateGroupStatus, useDeleteEmojiGroup } from "@features/emojis/api/mutations";
import { useAllEmojiGroupsAdmin } from "@features/emojis/api/queries";
import type { EmojiGroup } from "@features/emojis/model/types";
import { Badge } from "@shared/ui/badge";
import { Button } from "@shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@shared/ui/card";
import Empty from "@shared/ui/empty";
import { Input } from "@shared/ui/input";
import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle, Layers, Loader2, Plus, Power, PowerOff, Search } from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";
import { toast } from "sonner";

/**
 * /admin/emojis - 表情管理
 *
 * 统计卡片 + 工具栏 + 分组卡片网格，支持分组 CRUD 与批量启停，
 * 管理分组内表情走弹窗。排版对齐 main，组件与数据层沿用当前架构。
 */
export const Route = createFileRoute("/admin/emojis")({
	component: EmojisPage,
});

function StatsCard({
	title,
	value,
	icon,
	className,
}: {
	title: string;
	value: number;
	icon: ReactNode;
	className?: string;
}) {
	return (
		<Card className={className}>
			<CardHeader className="flex flex-row items-center justify-between pb-2">
				<CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
				{icon}
			</CardHeader>
			<CardContent>
				<div className="text-2xl font-bold">{value.toLocaleString()}</div>
			</CardContent>
		</Card>
	);
}

function StatsCardSkeleton() {
	return (
		<Card>
			<CardHeader className="flex flex-row items-center justify-between pb-2">
				<div className="h-4 w-20 rounded bg-muted" />
				<div className="size-5 rounded bg-muted" />
			</CardHeader>
			<CardContent>
				<div className="h-8 w-16 rounded bg-muted" />
			</CardContent>
		</Card>
	);
}

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

	const deleteGroup = useDeleteEmojiGroup(deleteConfirm.group?.id ?? 0);

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
		deleteGroup.mutate(undefined, {
			onSuccess: () => {
				toast.success("分组已删除");
				setDeleteConfirm({ open: false, group: null });
			},
			onError: (err) => {
				toast.error(err.message);
				setDeleteConfirm({ open: false, group: null });
			},
		});
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
		<div className="space-y-6">
			{/* 页面标题 */}
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-2xl font-bold">表情管理</h1>
					<p className="text-muted-foreground">管理表情分组和表情</p>
				</div>
				<Button onClick={handleCreateGroup}>
					<Plus className="mr-1.5 size-4" />
					创建分组
				</Button>
			</div>

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

			{/* 搜索与批量操作工具栏 */}
			{!isEmpty && (
				<Card>
					<CardContent className="py-4">
						<div className="flex flex-wrap items-center gap-3">
							<div className="relative min-w-[200px] max-w-[400px] flex-1">
								<Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
								<Input
									placeholder="搜索分组名称..."
									value={searchQuery}
									onChange={(e) => setSearchQuery(e.target.value)}
									className="pl-9"
								/>
							</div>

							<div className="flex items-center gap-2">
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
							</div>

							{searchQuery && (
								<Badge variant="secondary" className="ml-auto">
									显示 {filteredGroups.length} / {groups?.length ?? 0} 个分组
								</Badge>
							)}
						</div>
					</CardContent>
				</Card>
			)}

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
						<Button variant="outline" size="sm" onClick={() => refetch().catch(() => {})}>
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
						<Button onClick={handleCreateGroup}>
							<Plus className="mr-1 size-4" />
							创建分组
						</Button>
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
							onEdit={handleEditGroup}
							onDelete={handleDeleteGroup}
							onManageEmojis={handleManageEmojis}
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
				onOpenChange={(open) => !open && setDeleteConfirm({ open: false, group: null })}
				title="删除表情分组"
				description={`确定要删除表情分组「${deleteConfirm.group?.name ?? ""}」吗？分组内所有表情也将被删除，此操作不可撤销。`}
				confirmLabel="删除"
				loading={deleteGroup.isPending}
				onConfirm={confirmDeleteGroup}
			/>

			{/* 表情管理弹窗 */}
			<EmojiManageDialog open={emojisOpen} onOpenChange={setEmojisOpen} groupId={activeGroupId} />
		</div>
	);
}

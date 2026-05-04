/**
 * 表情管理页面
 * 支持表情分组的创建、编辑、删除，以及分组内表情的管理
 * 包含统计信息、搜索筛选、批量操作等功能
 */

import { useState, useMemo } from "react";
import {
  useEmojiGroups,
  useUpdateEmojiGroup,
  useDeleteEmojiGroup,
  useBatchUpdateGroupsStatus,
} from "@/hooks/useEmojisAdmin";
import type { EmojiGroupAdmin } from "@/hooks/useEmojisAdmin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorFallback } from "@/components/shared/ErrorFallback";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { GroupCardSkeleton } from "./GroupCardSkeleton";
import { EmojiGroupCard } from "./EmojiGroupCard";
import { EmojiGroupFormDialog } from "./EmojiGroupFormDialog";
import { EmojiManageDialog } from "@/features/emoji-management";
import {
  Plus,
  Smile,
  Search,
  Layers,
  CheckCircle,
  Power,
  PowerOff,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

/** 统计卡片组件 */
function StatsCard({
  title,
  value,
  icon,
  className,
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value.toLocaleString()}</div>
      </CardContent>
    </Card>
  );
}

/** 统计卡片骨架屏 */
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

export default function Emojis() {
  const { data: groups, isLoading, error, refetch } = useEmojiGroups();
  const updateGroup = useUpdateEmojiGroup();
  const deleteGroup = useDeleteEmojiGroup();
  const batchUpdateStatus = useBatchUpdateGroupsStatus();

  const [searchQuery, setSearchQuery] = useState("");
  const [groupFormOpen, setGroupFormOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<EmojiGroupAdmin | null>(
    null
  );
  const [deleteConfirm, setDeleteConfirm] = useState<{
    open: boolean;
    id: number;
    name: string;
  }>({
    open: false,
    id: 0,
    name: "",
  });
  const [emojisOpen, setEmojisOpen] = useState(false);
  const [activeGroupId, setActiveGroupId] = useState<number>(0);
  const [togglingGroupId, setTogglingGroupId] = useState<number | null>(null);

  // 计算统计数据
  const stats = useMemo(() => {
    if (!groups) return { total: 0, enabled: 0, disabled: 0 };
    const enabled = groups.filter((g) => g.is_enabled).length;
    return {
      total: groups.length,
      enabled,
      disabled: groups.length - enabled,
    };
  }, [groups]);

  // 筛选后的分组列表
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

  function handleEditGroup(group: EmojiGroupAdmin) {
    setEditingGroup(group);
    setGroupFormOpen(true);
  }

  function handleDeleteGroup(id: number, name: string) {
    setDeleteConfirm({ open: true, id, name });
  }

  function confirmDeleteGroup() {
    deleteGroup.mutate(deleteConfirm.id, {
      onSuccess: () => {
        toast.success("分组已删除");
        setDeleteConfirm({ open: false, id: 0, name: "" });
      },
      onError: () => {
        toast.error("删除失败");
        setDeleteConfirm({ open: false, id: 0, name: "" });
      },
    });
  }

  function handleManageEmojis(groupId: number) {
    setActiveGroupId(groupId);
    setEmojisOpen(true);
  }

  function handleToggleGroup(group: EmojiGroupAdmin) {
    setTogglingGroupId(group.id);
    updateGroup.mutate(
      { id: group.id, data: { is_enabled: !group.is_enabled } },
      {
        onSuccess: () => {
          toast.success(!group.is_enabled ? "已启用" : "已禁用");
          setTogglingGroupId(null);
        },
        onError: () => {
          toast.error("操作失败");
          setTogglingGroupId(null);
        },
      }
    );
  }

  // 批量启用所有分组
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
        onError: () => toast.error("批量启用失败"),
      }
    );
  }

  // 批量禁用所有分组
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
        onError: () => toast.error("批量禁用失败"),
      }
    );
  }

  const isEmpty = !isLoading && !error && (!groups || groups.length === 0);
  const isFilteredEmpty =
    !isLoading &&
    !error &&
    filteredGroups.length === 0 &&
    groups &&
    groups.length > 0;

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

      {/* 搜索和批量操作工具栏 */}
      {!isEmpty && (
        <Card>
          <CardContent className="py-4">
            <div className="flex flex-wrap items-center gap-3">
              {/* 搜索框 */}
              <div className="relative flex-1 min-w-[200px] max-w-[400px]">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="搜索分组名称..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>

              {/* 批量操作按钮 */}
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleBatchEnable}
                  disabled={
                    batchUpdateStatus.isPending ||
                    isLoading ||
                    stats.disabled === 0
                  }
                >
                  {batchUpdateStatus.isPending ? (
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
                  disabled={
                    batchUpdateStatus.isPending ||
                    isLoading ||
                    stats.enabled === 0
                  }
                >
                  {batchUpdateStatus.isPending ? (
                    <Loader2 className="mr-1 size-3.5 animate-spin" />
                  ) : (
                    <PowerOff className="mr-1 size-3.5" />
                  )}
                  批量禁用
                </Button>
              </div>

              {/* 筛选状态提示 */}
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
          {Array.from({ length: 6 }).map((_, i) => (
            <GroupCardSkeleton key={i} />
          ))}
        </div>
      )}

      {/* 错误状态 */}
      {error && <ErrorFallback error={error.message} onRetry={refetch} />}

      {/* 空数据状态 */}
      {isEmpty && (
        <EmptyState
          title="暂无表情分组"
          description="创建第一个表情分组开始管理表情"
          actionLabel="创建分组"
          onAction={handleCreateGroup}
          icon={<Smile className="size-12" />}
        />
      )}

      {/* 搜索无结果 */}
      {isFilteredEmpty && (
        <EmptyState
          title="未找到匹配的分组"
          description={`没有找到名称包含「${searchQuery}」的分组`}
          icon={<Search className="size-12" />}
        />
      )}

      {/* 分组卡片网格 */}
      {!isLoading && !error && filteredGroups.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredGroups.map((group) => (
            <EmojiGroupCard
              key={group.id}
              group={group}
              togglingGroupId={togglingGroupId}
              onToggle={handleToggleGroup}
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
        onClose={() => setDeleteConfirm({ open: false, id: 0, name: "" })}
        onConfirm={confirmDeleteGroup}
        title="删除表情分组"
        description={`确定要删除表情分组「${deleteConfirm.name}」吗？分组内所有表情也将被删除，此操作不可撤销。`}
        confirmLabel="删除"
        destructive
        isLoading={deleteGroup.isPending}
      />

      {/* 表情管理弹窗 */}
      <EmojiManageDialog
        open={emojisOpen}
        onOpenChange={setEmojisOpen}
        groupId={activeGroupId}
      />
    </div>
  );
}

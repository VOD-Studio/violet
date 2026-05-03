/**
 * 表情管理页面
 * 支持表情分组的创建、编辑、删除，以及分组内表情的管理
 */

import { useState } from "react";
import {
  useEmojiGroups,
  useUpdateEmojiGroup,
  useDeleteEmojiGroup,
} from "@/hooks/useEmojisAdmin";
import type { EmojiGroupAdmin } from "@/hooks/useEmojisAdmin";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorFallback } from "@/components/shared/ErrorFallback";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { GroupCardSkeleton } from "./GroupCardSkeleton";
import { EmojiGroupCard } from "./EmojiGroupCard";
import { EmojiGroupFormDialog } from "./EmojiGroupFormDialog";
import { EmojiManageDialog } from "./EmojiManageDialog";
import { Plus, Smile } from "lucide-react";
import { toast } from "sonner";

export default function Emojis() {
  const { data: groups, isLoading, error, refetch } = useEmojiGroups();
  const updateGroup = useUpdateEmojiGroup();
  const deleteGroup = useDeleteEmojiGroup();

  const [groupFormOpen, setGroupFormOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<EmojiGroupAdmin | null>(null);
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
      { id: group.id, data: { isEnabled: !group.isEnabled } },
      {
        onSuccess: () => {
          toast.success(!group.isEnabled ? "已启用" : "已禁用");
          setTogglingGroupId(null);
        },
        onError: () => {
          toast.error("操作失败");
          setTogglingGroupId(null);
        },
      },
    );
  }

  const isEmpty = !isLoading && !error && (!groups || groups.length === 0);

  return (
    <div className="space-y-6">
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

      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <GroupCardSkeleton key={i} />
          ))}
        </div>
      )}

      {error && <ErrorFallback error={error.message} onRetry={refetch} />}

      {isEmpty && (
        <EmptyState
          title="暂无表情分组"
          description="创建第一个表情分组开始管理表情"
          actionLabel="创建分组"
          onAction={handleCreateGroup}
          icon={<Smile className="size-12" />}
        />
      )}

      {!isLoading && !error && groups && groups.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((group) => (
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

      <EmojiGroupFormDialog
        open={groupFormOpen}
        onOpenChange={setGroupFormOpen}
        editingGroup={editingGroup}
        groupCount={groups?.length ?? 0}
      />

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

      <EmojiManageDialog
        open={emojisOpen}
        onOpenChange={setEmojisOpen}
        groupId={activeGroupId}
      />
    </div>
  );
}
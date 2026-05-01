/**
 * 表情包管理页面
 * 支持表情包组的创建、编辑、删除，以及组内表情包的上传和管理
 */

import { useState } from "react"
import { useStickerGroups, useUpdateStickerGroup, useDeleteStickerGroup } from "@/hooks/useStickersAdmin"
import type { StickerGroup } from "@/hooks/useStickersAdmin"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/shared/EmptyState"
import { ErrorFallback } from "@/components/shared/ErrorFallback"
import { ConfirmDialog } from "@/components/shared/ConfirmDialog"
import { GroupCardSkeleton } from "./GroupCardSkeleton"
import { StickerGroupCard } from "./StickerGroupCard"
import { StickerGroupFormDialog } from "./StickerGroupFormDialog"
import { StickerManageDialog } from "./StickerManageDialog"
import { Plus, Image as ImageIcon } from "lucide-react"
import { toast } from "sonner"

export default function Stickers() {
  const { data: groups, isLoading, error, refetch } = useStickerGroups()
  const updateGroup = useUpdateStickerGroup()
  const deleteGroup = useDeleteStickerGroup()

  const [groupFormOpen, setGroupFormOpen] = useState(false)
  const [editingGroup, setEditingGroup] = useState<StickerGroup | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id: string; name: string }>({
    open: false,
    id: "",
    name: "",
  })
  const [stickersOpen, setStickersOpen] = useState(false)
  const [activeGroupId, setActiveGroupId] = useState<string>("")
  const [togglingGroupId, setTogglingGroupId] = useState<string | null>(null)

  function handleCreateGroup() {
    setEditingGroup(null)
    setGroupFormOpen(true)
  }

  function handleEditGroup(group: StickerGroup) {
    setEditingGroup(group)
    setGroupFormOpen(true)
  }

  function handleDeleteGroup(id: string, name: string) {
    setDeleteConfirm({ open: true, id, name })
  }

  function confirmDeleteGroup() {
    deleteGroup.mutate(deleteConfirm.id, {
      onSuccess: () => {
        toast.success("组已删除")
        setDeleteConfirm({ open: false, id: "", name: "" })
      },
      onError: () => {
        toast.error("删除失败")
        setDeleteConfirm({ open: false, id: "", name: "" })
      },
    })
  }

  function handleManageStickers(groupId: string) {
    setActiveGroupId(groupId)
    setStickersOpen(true)
  }

  function handleToggleGroup(group: StickerGroup) {
    setTogglingGroupId(group.id)
    updateGroup.mutate(
      { id: group.id, data: { is_active: !group.is_active } },
      {
        onSuccess: () => {
          toast.success(!group.is_active ? "已启用" : "已禁用")
          setTogglingGroupId(null)
        },
        onError: () => {
          toast.error("操作失败")
          setTogglingGroupId(null)
        },
      }
    )
  }

  const isEmpty = !isLoading && !error && (!groups || groups.length === 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">表情包管理</h1>
          <p className="text-muted-foreground">管理表情包组和组内表情包</p>
        </div>
        <Button onClick={handleCreateGroup}>
          <Plus className="mr-1.5 size-4" />
          创建组
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
          title="暂无表情包组"
          description="创建第一个表情包组开始管理表情包"
          actionLabel="创建组"
          onAction={handleCreateGroup}
          icon={<ImageIcon className="size-12" />}
        />
      )}

      {!isLoading && !error && groups && groups.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((group) => (
            <StickerGroupCard
              key={group.id}
              group={group}
              togglingGroupId={togglingGroupId}
              onToggle={handleToggleGroup}
              onEdit={handleEditGroup}
              onDelete={handleDeleteGroup}
              onManageStickers={handleManageStickers}
            />
          ))}
        </div>
      )}

      <StickerGroupFormDialog
        open={groupFormOpen}
        onOpenChange={setGroupFormOpen}
        editingGroup={editingGroup}
        groupCount={groups?.length ?? 0}
      />

      <ConfirmDialog
        open={deleteConfirm.open}
        onClose={() => setDeleteConfirm({ open: false, id: "", name: "" })}
        onConfirm={confirmDeleteGroup}
        title="删除表情包组"
        description={`确定要删除表情包组「${deleteConfirm.name}」吗？组内所有表情包也将被删除，此操作不可撤销。`}
        confirmLabel="删除"
        destructive
        isLoading={deleteGroup.isPending}
      />

      <StickerManageDialog
        open={stickersOpen}
        onOpenChange={setStickersOpen}
        groupId={activeGroupId}
      />
    </div>
  )
}
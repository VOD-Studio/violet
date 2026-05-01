/**
 * 表情包管理页面
 * 支持表情包组的创建、编辑、删除，以及组内表情包的上传和管理
 */

import { useState } from "react"
import {
  useStickerGroups,
  useCreateStickerGroup,
  useUpdateStickerGroup,
  useDeleteStickerGroup,
  useStickers,
  useCreateSticker,
  useUpdateSticker,
  useDeleteSticker,
} from "@/hooks/useStickersAdmin"
import type { StickerGroup, StickerGroupFormData } from "@/hooks/useStickersAdmin"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/shared/EmptyState"
import { ErrorFallback } from "@/components/shared/ErrorFallback"
import { ConfirmDialog } from "@/components/shared/ConfirmDialog"
import StickerUploader from "@/components/admin/StickerUploader"
import type { UploadResult } from "@/components/upload/ChunkedUpload"
import { getUploadUrl } from "@/lib/api"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Plus,
  Trash2,
  Pencil,
  Star,
  Image as ImageIcon,
  Loader2,
} from "lucide-react"
import { toast } from "sonner"

/**
 * 表情包组卡片骨架屏
 */
function GroupCardSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-4 w-32" />
      </CardHeader>
      <CardContent>
        <div className="flex gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-12 rounded" />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * 表情包组管理页面
 */
export default function Stickers() {
  const { data: groups, isLoading, error, refetch } = useStickerGroups()
  const createGroup = useCreateStickerGroup()
  const updateGroup = useUpdateStickerGroup()
  const deleteGroup = useDeleteStickerGroup()

  /** 创建/编辑组弹窗状态 */
  const [groupFormOpen, setGroupFormOpen] = useState(false)
  const [editingGroup, setEditingGroup] = useState<StickerGroup | null>(null)
  const [groupForm, setGroupForm] = useState<StickerGroupFormData>({
    name: "",
    slug: "",
    icon: "",
    description: "",
    sort: 0,
    is_hot: false,
    is_active: true,
  })

  /** 删除确认弹窗状态 */
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id: string; name: string }>({
    open: false,
    id: "",
    name: "",
  })

  /** 表情包管理弹窗状态 */
  const [stickersOpen, setStickersOpen] = useState(false)
  const [activeGroupId, setActiveGroupId] = useState<string>("")

  /** 正在切换启用状态的组 ID */
  const [togglingGroupId, setTogglingGroupId] = useState<string | null>(null)

  /** 获取当前组的表情包 */
  const { data: stickers } = useStickers(activeGroupId)
  const createSticker = useCreateSticker()
  const updateSticker = useUpdateSticker()
  const deleteSticker = useDeleteSticker()

  /** 表情包删除确认状态 */
  const [stickerDeleteConfirm, setStickerDeleteConfirm] = useState<{ open: boolean; id: string }>({
    open: false,
    id: "",
  })

  /**
   * 打开创建组弹窗
   */
  function handleCreateGroup() {
    setEditingGroup(null)
    setGroupForm({
      name: "",
      slug: "",
      icon: "",
      description: "",
      sort: groups?.length ?? 0,
      is_hot: false,
      is_active: true,
    })
    setGroupFormOpen(true)
  }

  /**
   * 打开编辑组弹窗
   */
  function handleEditGroup(group: StickerGroup) {
    setEditingGroup(group)
    setGroupForm({
      name: group.name,
      slug: group.slug,
      icon: group.icon || "",
      description: group.description || "",
      sort: group.sort,
      is_hot: group.is_hot,
      is_active: group.is_active,
    })
    setGroupFormOpen(true)
  }

  /**
   * 提交创建/编辑组
   */
  function handleSubmitGroup() {
    if (!groupForm.name.trim()) {
      toast.error("请输入组名称")
      return
    }

    // 自动生成 slug（如果没有填写）
    const slug = groupForm.slug?.trim() || groupForm.name.trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^\w\-一-龥]/g, '') // 保留中文、英文、数字、下划线、横线

    const data: StickerGroupFormData = {
      name: groupForm.name.trim(),
      slug,
      icon: groupForm.icon?.trim() || undefined,
      description: groupForm.description?.trim() || undefined,
      sort: groupForm.sort,
      is_hot: groupForm.is_hot,
      is_active: groupForm.is_active,
    }

    if (editingGroup) {
      updateGroup.mutate(
        { id: editingGroup.id, data },
        {
          onSuccess: () => {
            toast.success("组已更新")
            setGroupFormOpen(false)
          },
          onError: () => toast.error("更新失败"),
        }
      )
    } else {
      createGroup.mutate(data, {
        onSuccess: () => {
          toast.success("组已创建")
          setGroupFormOpen(false)
        },
        onError: () => toast.error("创建失败"),
      })
    }
  }

  /**
   * 弹出删除组确认
   */
  function handleDeleteGroup(id: string, name: string) {
    setDeleteConfirm({ open: true, id, name })
  }

  /**
   * 确认删除组
   */
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

  /**
   * 打开表情包管理弹窗
   */
  function handleManageStickers(groupId: string) {
    setActiveGroupId(groupId)
    setStickersOpen(true)
  }

  /**
   * 表情包上传完成
   */
  function handleStickerUpload(result: UploadResult) {
    createSticker.mutate(
      { groupId: activeGroupId, url: result.url },
      {
        onSuccess: () => toast.success("表情包已添加"),
        onError: () => toast.error("添加失败"),
      }
    )
  }

  /**
   * 切换表情包启用状态
   */
  function handleToggleSticker(stickerId: string, currentEnabled: boolean) {
    updateSticker.mutate(
      { id: stickerId, data: { is_active: !currentEnabled } },
      {
        onSuccess: () => toast.success(!currentEnabled ? "已启用" : "已禁用"),
        onError: () => toast.error("操作失败"),
      }
    )
  }

  /**
   * 弹出删除表情包确认
   */
  function handleDeleteSticker(id: string) {
    setStickerDeleteConfirm({ open: true, id })
  }

  /**
   * 确认删除表情包
   */
  function confirmDeleteSticker() {
    deleteSticker.mutate(stickerDeleteConfirm.id, {
      onSuccess: () => {
        toast.success("表情包已删除")
        setStickerDeleteConfirm({ open: false, id: "" })
      },
      onError: () => {
        toast.error("删除失败")
        setStickerDeleteConfirm({ open: false, id: "" })
      },
    })
  }

  /**
   * 切换组启用状态
   */
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
      {/* 页面头部 */}
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

      {/* 加载态 */}
      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
          title="暂无表情包组"
          description="创建第一个表情包组开始管理表情包"
          actionLabel="创建组"
          onAction={handleCreateGroup}
          icon={<ImageIcon className="size-12" />}
        />
      )}

      {/* 表情包组卡片列表 */}
      {!isLoading && !error && groups && groups.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((group) => (
            <Card key={group.id} className={group.is_active ? "" : "opacity-60"}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {group.icon && (
                      <img
                        src={getUploadUrl(group.icon)}
                        alt={group.name}
                        className="h-6 w-6 rounded object-cover"
                      />
                    )}
                    <CardTitle className="text-base">{group.name}</CardTitle>
                    {group.is_hot && (
                      <Badge variant="secondary" className="text-xs">
                        <Star className="mr-0.5 size-3" />
                        热门
                      </Badge>
                    )}
                  </div>
                  <Switch
                    checked={group.is_active}
                    onCheckedChange={() => handleToggleGroup(group)}
                    loading={togglingGroupId === group.id}
                    disabled={togglingGroupId === group.id}
                  />
                </div>
                <CardDescription className="text-xs">
                  {group.description || `slug: ${group.slug}`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {/* 表情包预览 */}
                <div className="mb-3 flex gap-2">
                  {(group.sticker_count ?? 0) > 0 ? (
                    <div className="flex gap-2">
                      {/* 这里只显示数量，具体表情包在弹窗中管理 */}
                      <Badge variant="outline">{group.sticker_count ?? 0} 个表情包</Badge>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">暂无表情包</span>
                  )}
                </div>
                {/* 操作按钮 */}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleManageStickers(group.id)}
                  >
                    <ImageIcon className="mr-1 size-3.5" />
                    管理表情包
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => handleEditGroup(group)}
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => handleDeleteGroup(group.id, group.name)}
                  >
                    <Trash2 className="size-3.5 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* 创建/编辑组弹窗 */}
      <Dialog open={groupFormOpen} onOpenChange={setGroupFormOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingGroup ? "编辑表情包组" : "创建表情包组"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">名称</label>
              <Input
                value={groupForm.name}
                onChange={(e) => setGroupForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="如：经典表情"
                className="mt-1.5"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Slug（可选）</label>
              <Input
                value={groupForm.slug}
                onChange={(e) => setGroupForm((prev) => ({ ...prev, slug: e.target.value }))}
                placeholder="如：classic"
                className="mt-1.5"
              />
            </div>
            <div>
              <label className="text-sm font-medium">图标（可选）</label>
              <div className="mt-1.5">
                {groupForm.icon && (
                  <img
                    src={getUploadUrl(groupForm.icon)}
                    alt="图标预览"
                    className="h-10 w-10 rounded object-cover mb-2"
                  />
                )}
                <StickerUploader
                  onUpload={(result: UploadResult) => {
                    setGroupForm((prev) => ({ ...prev, icon: result.url }))
                    toast.success("图标上传成功")
                  }}
                  maxFiles={1}
                  accept={{ 'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp'] }}
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">描述（可选）</label>
              <Input
                value={groupForm.description}
                onChange={(e) => setGroupForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="组的简介"
                className="mt-1.5"
              />
            </div>
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">热门推荐</label>
              <Switch
                checked={groupForm.is_hot}
                onCheckedChange={(checked: boolean) =>
                  setGroupForm((prev) => ({ ...prev, is_hot: checked }))
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">启用状态</label>
              <Switch
                checked={groupForm.is_active}
                onCheckedChange={(checked: boolean) =>
                  setGroupForm((prev) => ({ ...prev, is_active: checked }))
                }
              />
            </div>
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row sm:gap-2 sm:justify-end mt-6 pt-4 border-t">
            <Button variant="outline" onClick={() => setGroupFormOpen(false)} className="w-full sm:w-auto">
              取消
            </Button>
            <Button
              onClick={handleSubmitGroup}
              disabled={createGroup.isPending || updateGroup.isPending}
              className="w-full sm:w-auto"
            >
              {(createGroup.isPending || updateGroup.isPending) && (
                <Loader2 className="mr-1 size-4 animate-spin" />
              )}
              {editingGroup ? "更新" : "创建"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除组确认弹窗 */}
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

      {/* 表情包管理弹窗 */}
      <Dialog open={stickersOpen} onOpenChange={setStickersOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>管理表情包</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* 上传区域 */}
            <StickerUploader onUpload={handleStickerUpload} />

            {/* 表情包列表 */}
            {stickers && stickers.length > 0 && (
              <div className="grid grid-cols-4 gap-3 sm:grid-cols-5 md:grid-cols-6">
                {stickers.map((sticker) => (
                  <div
                    key={sticker.id}
                    className={`group relative rounded-lg border p-1 ${
                      sticker.is_active ? "" : "opacity-50"
                    }`}
                  >
                    <img
                      src={getUploadUrl(sticker.image_url)}
                      alt="sticker"
                      className="aspect-square w-full rounded object-cover"
                    />
                    {/* 操作按钮 */}
                    <div className="absolute right-1 top-1 hidden gap-1 group-hover:flex">
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => handleToggleSticker(sticker.id, sticker.is_active)}
                        className="bg-background/80"
                      >
                        {sticker.is_active ? (
                          <span className="text-xs">禁</span>
                        ) : (
                          <span className="text-xs">启</span>
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => handleDeleteSticker(sticker.id)}
                        className="bg-background/80 text-destructive"
                      >
                        <Trash2 className="size-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {stickers && stickers.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-4">
                暂无表情包，上传图片添加表情包
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* 删除表情包确认弹窗 */}
      <ConfirmDialog
        open={stickerDeleteConfirm.open}
        onClose={() => setStickerDeleteConfirm({ open: false, id: "" })}
        onConfirm={confirmDeleteSticker}
        title="删除表情包"
        description="确定要删除这个表情包吗？此操作不可撤销。"
        confirmLabel="删除"
        destructive
        isLoading={deleteSticker.isPending}
      />
    </div>
  )
}
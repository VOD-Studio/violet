/**
 * 公告管理页面
 * 从 API 获取公告列表，支持创建、编辑、删除公告
 */

import { useState } from "react";
import {
  useAdminAnnouncements,
  useCreateAnnouncement,
  useUpdateAnnouncement,
  useDeleteAnnouncement,
} from "@/features/admin/announcements";
import type {
  Announcement,
  AnnouncementCreateInput,
  AnnouncementUpdateInput,
} from "@/features/admin/announcements/types";
import { PermissionGuard } from "@/components/shared/PermissionGuard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorFallback } from "@/components/shared/ErrorFallback";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { useToast } from "@/components/shared/Toast";
import { Bell, Pencil, Trash2, Plus, Loader2, Megaphone } from "lucide-react";

/** 公告类型颜色映射 */
const typeColors: Record<string, string> = {
  info: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  warning: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  success: "bg-green-500/10 text-green-600 border-green-500/20",
  error: "bg-red-500/10 text-red-600 border-red-500/20",
};

/** 公告类型标签映射 */
const typeLabels: Record<string, string> = {
  info: "信息",
  warning: "警告",
  success: "成功",
  error: "错误",
};

/**
 * 公告列表表格骨架屏
 */
function AnnouncementsTableSkeleton() {
  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-16">ID</TableHead>
            <TableHead>标题</TableHead>
            <TableHead className="w-20">类型</TableHead>
            <TableHead className="w-20">状态</TableHead>
            <TableHead className="w-32">创建时间</TableHead>
            <TableHead className="text-right w-32">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 5 }).map((_, i) => (
            <TableRow key={i}>
              <TableCell>
                <Skeleton className="h-4 w-8" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-32" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-6 w-12" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-6 w-12" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-24" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-8 w-24" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/**
 * 公告管理页面内容
 * 从 API 获取公告数据，提供创建、编辑、删除功能
 */
function AnnouncementsContent() {
  const { toast } = useToast();
  const [page, setPage] = useState(0);
  const [limit] = useState(20);

  const { data, isLoading, error, refetch } = useAdminAnnouncements(
    page,
    limit
  );
  const createAnnouncement = useCreateAnnouncement();
  const updateAnnouncement = useUpdateAnnouncement();
  const deleteAnnouncement = useDeleteAnnouncement();

  /** 创建/编辑公告弹窗状态 */
  const [dialog, setDialog] = useState<{
    open: boolean;
    mode: "create" | "edit";
    announcement?: Announcement;
  }>({ open: false, mode: "create" });

  /** 公告表单数据 */
  const [form, setForm] = useState({
    title: "",
    content: "",
    type: "info" as "info" | "warning" | "success" | "error",
    is_active: true,
  });

  /** 删除确认弹窗状态 */
  const [deleteConfirm, setDeleteConfirm] = useState<{
    open: boolean;
    announcement?: Announcement;
  }>({ open: false });

  /**
   * 打开创建公告弹窗
   */
  function handleCreate() {
    setForm({ title: "", content: "", type: "info", is_active: true });
    setDialog({ open: true, mode: "create" });
  }

  /**
   * 打开编辑公告弹窗
   */
  function handleEdit(announcement: Announcement) {
    setForm({
      title: announcement.title,
      content: announcement.content,
      type: announcement.type,
      is_active: announcement.is_active,
    });
    setDialog({ open: true, mode: "edit", announcement });
  }

  /**
   * 提交公告表单
   */
  function handleSubmit() {
    if (!form.title.trim() || !form.content.trim()) {
      toast("标题和内容不能为空", "error");
      return;
    }

    if (dialog.mode === "create") {
      const input: AnnouncementCreateInput = {
        title: form.title.trim(),
        content: form.content.trim(),
        type: form.type,
        is_active: form.is_active,
      };
      createAnnouncement.mutate(input, {
        onSuccess: () => {
          toast("公告创建成功", "success");
          setDialog({ open: false, mode: "create" });
        },
        onError: () => {
          toast("创建公告失败", "error");
        },
      });
    } else if (dialog.announcement) {
      const input: AnnouncementUpdateInput = {
        title: form.title.trim(),
        content: form.content.trim(),
        type: form.type,
        is_active: form.is_active,
      };
      updateAnnouncement.mutate(
        { id: dialog.announcement.id, input },
        {
          onSuccess: () => {
            toast("公告更新成功", "success");
            setDialog({ open: false, mode: "edit" });
          },
          onError: () => {
            toast("更新公告失败", "error");
          },
        }
      );
    }
  }

  /**
   * 打开删除确认弹窗
   */
  function handleDeleteClick(announcement: Announcement) {
    setDeleteConfirm({ open: true, announcement });
  }

  /**
   * 确认删除公告
   */
  function confirmDelete() {
    if (deleteConfirm.announcement) {
      deleteAnnouncement.mutate(deleteConfirm.announcement.id, {
        onSuccess: () => {
          toast("公告删除成功", "success");
          setDeleteConfirm({ open: false });
        },
        onError: () => {
          toast("删除公告失败", "error");
        },
      });
    }
  }

  const announcements = data?.announcements || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">公告管理</h1>
          <p className="text-muted-foreground">管理网站公告信息</p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="mr-2 size-4" />
          创建公告
        </Button>
      </div>

      {/* 加载态 */}
      {isLoading && <AnnouncementsTableSkeleton />}

      {/* 错误状态 */}
      {error && <ErrorFallback error={error.message} onRetry={refetch} />}

      {/* 空数据状态 */}
      {!isLoading && !error && announcements.length === 0 && (
        <EmptyState
          title="暂无公告数据"
          description="点击上方按钮创建第一个公告"
          icon={<Megaphone className="size-12" />}
          actionLabel="创建公告"
          onAction={handleCreate}
        />
      )}

      {/* 公告列表表格 */}
      {!isLoading && !error && announcements.length > 0 && (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">ID</TableHead>
                <TableHead>标题</TableHead>
                <TableHead className="w-20">类型</TableHead>
                <TableHead className="w-20">状态</TableHead>
                <TableHead className="w-32">创建时间</TableHead>
                <TableHead className="text-right w-32">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {announcements.map((announcement: Announcement) => (
                <TableRow key={announcement.id}>
                  <TableCell className="font-mono text-muted-foreground">
                    {announcement.id}
                  </TableCell>
                  <TableCell className="font-medium">
                    {announcement.title}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={typeColors[announcement.type]}
                    >
                      {typeLabels[announcement.type]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={announcement.is_active ? "default" : "secondary"}
                    >
                      {announcement.is_active ? "启用" : "禁用"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(announcement.created_at).toLocaleDateString(
                      "zh-CN"
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(announcement)}
                        title="编辑"
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeleteClick(announcement)}
                        title="删除"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* 分页 */}
      {!isLoading && !error && totalPages > 1 && (
        <div className="flex items-center justify-center gap-4">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 0}
            onClick={() => setPage(page - 1)}
          >
            上一页
          </Button>
          <span className="text-sm text-muted-foreground">
            第 {page + 1} / {totalPages} 页
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages - 1}
            onClick={() => setPage(page + 1)}
          >
            下一页
          </Button>
        </div>
      )}

      {/* 创建/编辑公告弹窗 */}
      <Dialog
        open={dialog.open}
        onOpenChange={(open) => setDialog((prev) => ({ ...prev, open }))}
      >
        <DialogContent className="max-w-md sm:max-w-lg md:max-w-xl lg:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {dialog.mode === "create" ? "创建公告" : "编辑公告"}
            </DialogTitle>
            <DialogDescription>
              {dialog.mode === "create"
                ? "输入公告信息来创建新公告"
                : "修改公告信息"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">标题</Label>
              <Input
                id="title"
                value={form.title}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, title: e.target.value }))
                }
                placeholder="请输入公告标题"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="content">内容</Label>
              <Textarea
                id="content"
                value={form.content}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, content: e.target.value }))
                }
                placeholder="请输入公告内容"
                rows={4}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="type">类型</Label>
              <Select
                value={form.type}
                onValueChange={(value) =>
                  setForm((prev) => ({
                    ...prev,
                    type: value as "info" | "warning" | "success" | "error",
                  }))
                }
              >
                <SelectTrigger id="type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="info">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={typeColors.info}>
                        信息
                      </Badge>
                    </div>
                  </SelectItem>
                  <SelectItem value="warning">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={typeColors.warning}>
                        警告
                      </Badge>
                    </div>
                  </SelectItem>
                  <SelectItem value="success">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={typeColors.success}>
                        成功
                      </Badge>
                    </div>
                  </SelectItem>
                  <SelectItem value="error">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={typeColors.error}>
                        错误
                      </Badge>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_active"
                checked={form.is_active}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, is_active: e.target.checked }))
                }
                className="size-4 accent-primary"
              />
              <Label htmlFor="is_active">启用公告</Label>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialog({ open: false, mode: "create" })}
            >
              取消
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={
                !form.title.trim() ||
                !form.content.trim() ||
                createAnnouncement.isPending ||
                updateAnnouncement.isPending
              }
            >
              {(createAnnouncement.isPending ||
                updateAnnouncement.isPending) && (
                <Loader2 className="mr-2 size-4 animate-spin" />
              )}
              {dialog.mode === "create" ? "创建" : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认弹窗 */}
      <ConfirmDialog
        open={deleteConfirm.open}
        onClose={() => setDeleteConfirm({ open: false })}
        onConfirm={confirmDelete}
        title="删除公告"
        description={`确定要删除公告「${deleteConfirm.announcement?.title}」吗？此操作不可撤销。`}
        confirmLabel="删除"
        destructive
        isLoading={deleteAnnouncement.isPending}
      />
    </div>
  );
}

/**
 * 公告管理页面
 * 包裹权限守卫，需要 announcement:manage 权限
 */
export default function Announcements() {
  return (
    <PermissionGuard code="announcement:manage" fallback={<NoPermission />}>
      <AnnouncementsContent />
    </PermissionGuard>
  );
}

/** 无权限提示组件 */
function NoPermission() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-muted">
        <Bell className="size-6 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-medium">无权限访问</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        您没有公告管理权限，请联系管理员
      </p>
    </div>
  );
}

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
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorFallback } from "@/components/shared/ErrorFallback";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { useToast } from "@/components/shared/Toast";
import { Plus, Megaphone } from "lucide-react";
import {
  type AnnouncementFormData,
  AnnouncementFormDialog,
} from "./components/AnnouncementFormDialog";
import { AnnouncementsTable } from "./components/AnnouncementsTable";
import { AnnouncementsTableSkeleton } from "./components/AnnouncementsTableSkeleton";

/**
 * 公告管理页面内容
 * 从 API 获取公告数据，提供创建、编辑、删除功能
 */
export default function Announcements() {
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
  const [form, setForm] = useState<AnnouncementFormData>({
    title: "",
    content: "",
    type: "info",
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
  const handleCreate = () => {
    setForm({ title: "", content: "", type: "info", is_active: true });
    setDialog({ open: true, mode: "create" });
  };

  /**
   * 打开编辑公告弹窗
   */
  const handleEdit = (announcement: Announcement) => {
    setForm({
      title: announcement.title,
      content: announcement.content,
      type: announcement.type,
      is_active: announcement.is_active,
    });
    setDialog({ open: true, mode: "edit", announcement });
  };

  /**
   * 提交公告表单
   */
  const handleSubmit = () => {
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
  };

  /**
   * 打开删除确认弹窗
   */
  const handleDeleteClick = (announcement: Announcement) => {
    setDeleteConfirm({ open: true, announcement });
  };

  /**
   * 确认删除公告
   */
  const confirmDelete = () => {
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
  };

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
        <AnnouncementsTable
          announcements={announcements}
          onEdit={handleEdit}
          onDelete={handleDeleteClick}
        />
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
      <AnnouncementFormDialog
        open={dialog.open}
        mode={dialog.mode}
        form={form}
        onFormChange={setForm}
        onSubmit={handleSubmit}
        onClose={() => setDialog({ open: false, mode: "create" })}
        isPending={createAnnouncement.isPending || updateAnnouncement.isPending}
      />

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

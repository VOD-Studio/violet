/**
 * 项目管理页面
 * 支持创建、编辑、删除项目，管理展示在关于页面的项目列表
 */

import { useState } from "react";
import {
  useProjects,
  useCreateProject,
  useUpdateProject,
  useDeleteProject,
} from "@/features/projects";
import type { Project, CreateProjectInput, UpdateProjectInput } from "@/features/projects";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorFallback } from "@/components/shared/ErrorFallback";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Plus, FolderKanban } from "lucide-react";
import { ProjectsTableSkeleton } from "./components/ProjectsTableSkeleton";
import { ProjectsTable } from "./components/ProjectsTable";
import { ProjectFormDialog } from "./components/ProjectFormDialog";

/**
 * 项目管理页面
 */
export default function Projects() {
  const { data: projects, isLoading, error, refetch } = useProjects();
  const createProject = useCreateProject();
  const updateProject = useUpdateProject();
  const deleteProject = useDeleteProject();

  /** 弹窗状态 */
  const [dialog, setDialog] = useState<{
    open: boolean;
    mode: "create" | "edit";
    project: Project | null;
  }>({ open: false, mode: "create", project: null });

  /** 删除确认状态 */
  const [deleteConfirm, setDeleteConfirm] = useState<{
    open: boolean;
    project: Project | null;
  }>({ open: false, project: null });

  /** 打开创建弹窗 */
  const openCreate = () => {
    setDialog({ open: true, mode: "create", project: null });
  };

  /** 打开编辑弹窗 */
  const openEdit = (project: Project) => {
    setDialog({ open: true, mode: "edit", project });
  };

  /** 关闭弹窗 */
  const closeDialog = () => {
    setDialog({ open: false, mode: "create", project: null });
  };

  /** 打开删除确认 */
  const openDelete = (project: Project) => {
    setDeleteConfirm({ open: true, project });
  };

  /** 关闭删除确认 */
  const closeDelete = () => {
    setDeleteConfirm({ open: false, project: null });
  };

  /** 创建项目 */
  const handleCreate = (data: CreateProjectInput) => {
    createProject.mutate(data, { onSuccess: closeDialog });
  };

  /** 更新项目 */
  const handleUpdate = (id: string, data: UpdateProjectInput) => {
    updateProject.mutate({ id, data }, { onSuccess: closeDialog });
  };

  /** 确认删除 */
  const confirmDelete = () => {
    if (deleteConfirm.project) {
      deleteProject.mutate(deleteConfirm.project.id, {
        onSuccess: closeDelete,
      });
    }
  };

  const isPending = createProject.isPending || updateProject.isPending;

  return (
    <div className="space-y-6">
      {/* 页面头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">项目管理</h1>
          <p className="text-muted-foreground">管理展示在关于页面的项目</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 size-4" />
          新建项目
        </Button>
      </div>

      {/* 加载态 */}
      {isLoading && <ProjectsTableSkeleton />}

      {/* 错误状态 */}
      {error && <ErrorFallback error={error.message} onRetry={refetch} />}

      {/* 空数据状态 */}
      {!isLoading && !error && (!projects || projects.length === 0) && (
        <EmptyState
          title="暂无项目数据"
          description="点击上方按钮创建第一个项目"
          icon={<FolderKanban className="size-12" />}
          actionLabel="新建项目"
          onAction={openCreate}
        />
      )}

      {/* 项目表格 */}
      {!isLoading && !error && projects && projects.length > 0 && (
        <ProjectsTable
          projects={projects}
          onEdit={openEdit}
          onDelete={openDelete}
        />
      )}

      {/* 创建/编辑弹窗 */}
      <ProjectFormDialog
        open={dialog.open}
        mode={dialog.mode}
        project={dialog.project}
        onCreate={handleCreate}
        onUpdate={handleUpdate}
        onClose={closeDialog}
        isPending={isPending}
      />

      {/* 删除确认弹窗 */}
      <ConfirmDialog
        open={deleteConfirm.open}
        onClose={closeDelete}
        onConfirm={confirmDelete}
        title="删除项目"
        description={`确定要删除项目「${deleteConfirm.project?.title}」吗？此操作不可撤销。`}
        confirmLabel="删除"
        destructive
        isLoading={deleteProject.isPending}
      />
    </div>
  );
}
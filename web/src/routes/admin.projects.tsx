import { PageShell } from "@features/admin-layout/ui/PageShell";
import { Cover } from "@features/admin-media/ui/Cover";
import {
    useCreateProject,
    useDeleteProject,
    useUpdateProject,
} from "@features/admin-projects/api/mutations";
import type { CreateProject } from "@features/admin-projects/model/types";
import { ConfirmDialog } from "@features/admin-shared/ui/confirm-dialog";
import {
    DataTable,
    type DataTableColumn,
    type DataTableSort,
} from "@features/admin-shared/ui/data-table";
import { useHasPermission } from "@features/auth/hooks/usePermissions";
import { useProjects } from "@features/projects/api/queries";
import type { Project } from "@features/projects/model/types";
import { Badge } from "@shared/ui/base/badge";
import { Button } from "@shared/ui/base/button";
import { Input } from "@shared/ui/base/input";
import { Modal } from "@shared/ui/modal";
import { createFileRoute } from "@tanstack/react-router";
import { Code, ExternalLink, Pencil, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Textarea } from "@/shared/ui/base/textarea";

/** 创建/编辑表单初值 */
const EMPTY: CreateProject = {
    title: "",
    description: "",
    url: "",
    github_url: "",
    image_url: "",
    tech_stack: [],
    sort_order: 0,
};

function AdminProjectsPage() {
    const { data: projects = [], isLoading, error, refetch } = useProjects();
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [sort, setSort] = useState<DataTableSort | null>(null);

    const canCreate = useHasPermission("project:create");
    const canUpdate = useHasPermission("project:update");
    const canDelete = useHasPermission("project:delete");

    const sortedProjects = useMemo(() => {
        if (!sort) return projects;
        const copy = [...projects];
        copy.sort((a, b) => {
            const av = a[sort.key as keyof Project];
            const bv = b[sort.key as keyof Project];
            const cmp = String(av).localeCompare(String(bv), "zh");
            return sort.order === "asc" ? cmp : -cmp;
        });
        return copy;
    }, [projects, sort]);

    // TODO: 项目管理当前无批量操作后端接口；如需复选框批量删除，需后端支持。
    // TODO: 项目有 sort_order 字段，但缺少拖拽排序批量更新接口（如 POST /admin/projects/reorder）。

    const openCreate = () => {
        setEditingId(null);
        setDialogOpen(true);
    };

    const openEdit = (p: Project) => {
        setEditingId(p.id);
        setDialogOpen(true);
    };

    const columns: DataTableColumn<Project>[] = [
        {
            key: "title",
            header: "标题",
            hideable: false,
            sortable: true,
            ellipsis: true,
            cell: (row) => <span className="font-medium">{row.title}</span>,
        },
        {
            key: "description",
            header: "描述",
            ellipsis: true,
            cell: (row) => (
                <span className="line-clamp-1 text-sm text-muted-foreground">
                    {row.description}
                </span>
            ),
        },
        {
            key: "tech_stack",
            header: "技术栈",
            cell: (row) =>
                row.tech_stack?.map((t) => (
                    <Badge key={t} variant="secondary" className="mr-1">
                        {t}
                    </Badge>
                )),
        },
        {
            key: "sort_order",
            header: "排序",
            sortable: true,
            cell: (row) => row.sort_order,
        },
        {
            key: "url",
            header: "链接",
            cell: (row) => (
                <div className="flex items-center gap-2">
                    {row.url && (
                        <a
                            href={row.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-muted-foreground hover:text-primary"
                        >
                            <ExternalLink className="size-4" />
                        </a>
                    )}
                    {row.github_url && (
                        <a
                            href={row.github_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-muted-foreground hover:text-primary"
                        >
                            <Code className="size-4" />
                        </a>
                    )}
                </div>
            ),
        },
        {
            key: "_actions",
            header: "操作",
            sticky: "right",
            width: "120px",
            cell: (row) => (
                <div className="flex items-center gap-1">
                    {canUpdate ? (
                        <Button size="sm" variant="ghost" onClick={() => openEdit(row)}>
                            <Pencil className="size-4" />
                        </Button>
                    ) : null}
                    {canDelete ? (
                        <Button size="sm" variant="ghost" onClick={() => setDeleteId(row.id)}>
                            <Trash2 className="size-4" />
                        </Button>
                    ) : null}
                </div>
            ),
        },
    ];

    return (
        <PageShell
            title="项目管理"
            description="管理展示在「项目」页的项目"
            action={
                canCreate ? (
                    <Button onClick={openCreate}>
                        <Plus className="size-4" /> 创建项目
                    </Button>
                ) : null
            }
        >
            <DataTable<Project>
                data={sortedProjects}
                columns={columns}
                keyExtractor={(row) => row.id}
                page={1}
                pageSize={sortedProjects.length}
                total={sortedProjects.length}
                onPageChange={() => {}}
                selectable={false}
                loading={isLoading}
                error={error ? new Error(error.message) : null}
                onRetry={() => refetch()}
                sort={sort}
                onSortChange={setSort}
                storageKey="admin-projects-columns"
                caption="项目列表"
                emptyTitle="暂无项目"
                emptyDescription="还没有创建任何项目"
            />

            {dialogOpen && (
                <ProjectDialog
                    open={dialogOpen}
                    onOpenChange={setDialogOpen}
                    editingId={editingId}
                />
            )}

            <DeleteProjectDialog
                deleteId={deleteId}
                onOpenChange={(open) => !open && setDeleteId(null)}
            />
        </PageShell>
    );
}

/** ProjectDialog - 创建/编辑项目弹窗（编辑时在顶层调用 useUpdateProject） */
function ProjectDialog({
    open,
    onOpenChange,
    editingId,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    editingId: string | null;
}) {
    const createMut = useCreateProject();
    const updateMut = useUpdateProject(editingId ?? "");
    const isEditing = !!editingId;

    const { data: projects = [] } = useProjects();
    const editing = isEditing ? projects.find((p) => p.id === editingId) : undefined;

    const { register, handleSubmit, control } = useForm<CreateProject>({
        values:
            isEditing && editing
                ? {
                      title: editing.title,
                      description: editing.description,
                      url: editing.url,
                      github_url: editing.github_url,
                      image_url: editing.image_url,
                      tech_stack: editing.tech_stack,
                      sort_order: editing.sort_order,
                  }
                : EMPTY,
    });

    const onSubmit = (values: CreateProject) => {
        const onSuccess = () => onOpenChange(false);
        if (isEditing) {
            updateMut.mutate(values, { onSuccess });
        } else {
            createMut.mutate(values, { onSuccess });
        }
    };

    return (
        <Modal
            open={open}
            onOpenChange={onOpenChange}
            title={isEditing ? "编辑项目" : "创建项目"}
            size="md"
            footer={
                <Button
                    type="submit"
                    form="project-form"
                    disabled={createMut.isPending || updateMut.isPending}
                >
                    {isEditing ? "保存" : "创建"}
                </Button>
            }
        >
            <form id="project-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-1.5">
                    <label htmlFor="project-title" className="text-sm font-medium">
                        标题 <span className="text-destructive">*</span>
                    </label>
                    <Input id="project-title" {...register("title", { required: true })} />
                </div>
                <div className="space-y-1.5">
                    <label htmlFor="project-desc" className="text-sm font-medium">
                        描述
                    </label>
                    <Textarea id="project-desc" rows={3} {...register("description")} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label htmlFor="project-url" className="text-sm font-medium">
                            演示 URL
                        </label>
                        <Input id="project-url" {...register("url")} />
                    </div>
                    <div className="space-y-1.5">
                        <label htmlFor="project-github" className="text-sm font-medium">
                            GitHub URL
                        </label>
                        <Input id="project-github" {...register("github_url")} />
                    </div>
                </div>
                <div className="space-y-1.5">
                    <label htmlFor="project-cover" className="text-sm font-medium">
                        封面图
                    </label>
                    <Controller
                        name="image_url"
                        control={control}
                        render={({ field }) => (
                            <Cover
                                id="project-cover"
                                value={field.value}
                                onChange={field.onChange}
                                onClear={() => field.onChange("")}
                                title="选择项目封面图"
                            />
                        )}
                    />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label htmlFor="project-stack" className="text-sm font-medium">
                            技术栈（逗号分隔）
                        </label>
                        <Controller
                            name="tech_stack"
                            control={control}
                            defaultValue={[]}
                            render={({ field }) => (
                                <Input
                                    id="project-stack"
                                    value={
                                        Array.isArray(field.value)
                                            ? field.value.join(", ")
                                            : (field.value ?? "")
                                    }
                                    onChange={(e) =>
                                        field.onChange(
                                            e.target.value
                                                ? e.target.value
                                                      .split(",")
                                                      .map((s) => s.trim())
                                                      .filter(Boolean)
                                                : [],
                                        )
                                    }
                                    placeholder="React, Go, PostgreSQL"
                                />
                            )}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label htmlFor="project-sort" className="text-sm font-medium">
                            排序
                        </label>
                        <Input
                            id="project-sort"
                            type="number"
                            {...register("sort_order", { valueAsNumber: true })}
                        />
                    </div>
                </div>
            </form>
        </Modal>
    );
}

/** DeleteProjectDialog - 删除确认（顶层调用 useDeleteProject） */
function DeleteProjectDialog({
    deleteId,
    onOpenChange,
}: {
    deleteId: string | null;
    onOpenChange: (open: boolean) => void;
}) {
    const deleteMut = useDeleteProject(deleteId ?? "");
    return (
        <ConfirmDialog
            open={!!deleteId}
            onOpenChange={onOpenChange}
            onConfirm={() => {
                if (deleteId) deleteMut.mutate();
                onOpenChange(false);
            }}
            title="确认删除项目"
            description="确定要删除这个项目吗？"
            confirmLabel="删除"
            loading={deleteMut.isPending}
        />
    );
}

export const Route = createFileRoute("/admin/projects")({
    component: AdminProjectsPage,
});

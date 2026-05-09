import { useState } from "react";
import { useProjects, useCreateProject, useUpdateProject, useDeleteProject } from "@/features/projects";
import type { Project, CreateProjectInput, UpdateProjectInput } from "@/features/projects";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorFallback } from "@/components/shared/ErrorFallback";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { useToast } from "@/components/shared/Toast";
import { Plus, Pencil, Trash2, Loader2, FolderKanban, ExternalLink } from "lucide-react";

const ProjectsTableSkeleton = () => (
  <div className="rounded-lg border">
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-20">封面</TableHead>
          <TableHead>项目名称</TableHead>
          <TableHead>描述</TableHead>
          <TableHead>技术栈</TableHead>
          <TableHead className="w-20">排序</TableHead>
          <TableHead className="text-right">操作</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {Array.from({ length: 5 }).map((_, i) => (
          <TableRow key={i}>
            <TableCell><Skeleton className="size-7 rounded" /></TableCell>
            <TableCell><Skeleton className="h-4 w-24" /></TableCell>
            <TableCell><Skeleton className="h-4 w-40" /></TableCell>
            <TableCell><Skeleton className="h-4 w-32" /></TableCell>
            <TableCell><Skeleton className="h-4 w-8" /></TableCell>
            <TableCell><Skeleton className="h-8 w-24" /></TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </div>
);

const initialForm = {
  title: "",
  description: "",
  url: "",
  github_url: "",
  image_url: "",
  tech_stack: [] as string[],
  sort_order: 0,
};

export default function Projects() {
  const { toast } = useToast();
  const { data: projects, isLoading, error, refetch } = useProjects();
  const createProject = useCreateProject();
  const updateProject = useUpdateProject();
  const deleteProject = useDeleteProject();

  const [dialog, setDialog] = useState<{
    open: boolean;
    mode: "create" | "edit";
    project: Project | null;
  }>({ open: false, mode: "create", project: null });

  const [form, setForm] = useState(initialForm);
  const [techInput, setTechInput] = useState("");

  const [deleteConfirm, setDeleteConfirm] = useState<{
    open: boolean;
    project: Project | null;
  }>({ open: false, project: null });

  const openCreate = () => {
    setForm(initialForm);
    setTechInput("");
    setDialog({ open: true, mode: "create", project: null });
  };

  const openEdit = (project: Project) => {
    setForm({
      title: project.title,
      description: project.description ?? "",
      url: project.url ?? "",
      github_url: project.github_url ?? "",
      image_url: project.image_url ?? "",
      tech_stack: [...project.tech_stack],
      sort_order: project.sort_order,
    });
    setTechInput("");
    setDialog({ open: true, mode: "edit", project });
  };

  const closeDialog = () => {
    setDialog({ open: false, mode: "create", project: null });
  };

  const openDelete = (project: Project) => {
    setDeleteConfirm({ open: true, project });
  };

  const closeDelete = () => {
    setDeleteConfirm({ open: false, project: null });
  };

  const addTechTag = () => {
    const tag = techInput.trim();
    if (tag && !form.tech_stack.includes(tag)) {
      setForm((prev) => ({ ...prev, tech_stack: [...prev.tech_stack, tag] }));
    }
    setTechInput("");
  };

  const removeTechTag = (tag: string) => {
    setForm((prev) => ({
      ...prev,
      tech_stack: prev.tech_stack.filter((t) => t !== tag),
    }));
  };

  const handleSubmit = () => {
    const title = form.title.trim();
    if (!title) return;

    if (dialog.mode === "create") {
      const data: CreateProjectInput = {
        title,
        description: form.description.trim() || undefined,
        url: form.url.trim() || undefined,
        github_url: form.github_url.trim() || undefined,
        image_url: form.image_url.trim() || undefined,
        tech_stack: form.tech_stack.length > 0 ? form.tech_stack : undefined,
        sort_order: form.sort_order,
      };
      createProject.mutate(data, { onSuccess: () => closeDialog() });
    } else if (dialog.project) {
      const data: UpdateProjectInput = {
        title,
        description: form.description.trim() || undefined,
        url: form.url.trim() || undefined,
        github_url: form.github_url.trim() || undefined,
        image_url: form.image_url.trim() || undefined,
        tech_stack: form.tech_stack.length > 0 ? form.tech_stack : undefined,
        sort_order: form.sort_order,
      };
      updateProject.mutate(
        { id: dialog.project.id, data },
        { onSuccess: () => closeDialog() },
      );
    }
  };

  const confirmDelete = () => {
    if (deleteConfirm.project) {
      deleteProject.mutate(deleteConfirm.project.id, {
        onSuccess: () => closeDelete(),
      });
    }
  };

  const isPending = createProject.isPending || updateProject.isPending;

  return (
    <div className="space-y-6">
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

      {isLoading && <ProjectsTableSkeleton />}
      {error && <ErrorFallback error={error.message} onRetry={refetch} />}

      {!isLoading && !error && (!projects || projects.length === 0) && (
        <EmptyState
          title="暂无项目数据"
          description="点击上方按钮创建第一个项目"
          icon={<FolderKanban className="size-12" />}
          actionLabel="新建项目"
          onAction={openCreate}
        />
      )}

      {!isLoading && !error && projects && projects.length > 0 && (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-20">封面</TableHead>
                <TableHead>项目名称</TableHead>
                <TableHead>描述</TableHead>
                <TableHead>技术栈</TableHead>
                <TableHead className="w-20">排序</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projects.map((project) => (
                <TableRow key={project.id}>
                  <TableCell>
                    {project.image_url ? (
                      <img
                        src={project.image_url}
                        alt={project.title}
                        className="size-10 rounded object-cover"
                      />
                    ) : (
                      <div className="flex size-10 items-center justify-center rounded bg-muted">
                        <FolderKanban className="size-4 text-muted-foreground" />
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{project.title}</span>
                      {project.url && (
                        <a
                          href={project.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <ExternalLink className="size-3.5" />
                        </a>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-48 truncate text-muted-foreground">
                    {project.description || "-"}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {project.tech_stack.map((tech) => (
                        <Badge key={tech} variant="secondary" className="text-xs">
                          {tech}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {project.sort_order}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => openEdit(project)} title="编辑">
                        <Pencil className="size-4" />
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => openDelete(project)} title="删除">
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

      <Dialog open={dialog.open} onOpenChange={(v) => { if (!v) closeDialog(); }}>
        <DialogContent className="max-w-md sm:max-w-lg md:max-w-xl lg:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{dialog.mode === "create" ? "新建项目" : "编辑项目"}</DialogTitle>
            <DialogDescription>
              {dialog.mode === "create" ? "填写项目信息来创建新项目" : "修改项目信息"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="project-title">项目名称</Label>
              <Input
                id="project-title"
                value={form.title}
                onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="请输入项目名称"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="project-desc">描述（可选）</Label>
              <Textarea
                id="project-desc"
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="请输入项目描述"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="project-url">项目链接（可选）</Label>
              <Input
                id="project-url"
                value={form.url}
                onChange={(e) => setForm((prev) => ({ ...prev, url: e.target.value }))}
                placeholder="https://example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="project-github">GitHub 链接（可选）</Label>
              <Input
                id="project-github"
                value={form.github_url}
                onChange={(e) => setForm((prev) => ({ ...prev, github_url: e.target.value }))}
                placeholder="https://github.com/..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="project-image">封面图片链接（可选）</Label>
              <Input
                id="project-image"
                value={form.image_url}
                onChange={(e) => setForm((prev) => ({ ...prev, image_url: e.target.value }))}
                placeholder="https://example.com/cover.png"
              />
            </div>
            <div className="space-y-2">
              <Label>技术栈</Label>
              <div className="flex gap-2">
                <Input
                  value={techInput}
                  onChange={(e) => setTechInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addTechTag();
                    }
                  }}
                  placeholder="输入技术名称后按 Enter 添加"
                />
              </div>
              {form.tech_stack.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {form.tech_stack.map((tag) => (
                    <Badge
                      key={tag}
                      variant="secondary"
                      className="cursor-pointer"
                      onClick={() => removeTechTag(tag)}
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="project-sort">排序序号</Label>
              <Input
                id="project-sort"
                type="number"
                value={form.sort_order}
                onChange={(e) => setForm((prev) => ({ ...prev, sort_order: Number(e.target.value) }))}
                placeholder="0"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>取消</Button>
            <Button
              onClick={handleSubmit}
              disabled={!form.title.trim() || isPending}
            >
              {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
              {dialog.mode === "create" ? "创建" : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

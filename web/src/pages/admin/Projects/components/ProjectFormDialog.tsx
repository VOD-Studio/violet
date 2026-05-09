/**
 * 项目表单弹窗组件
 * 用于创建和编辑项目
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import type { Project, CreateProjectInput, UpdateProjectInput } from "@/features/projects";

/** 项目表单数据 */
interface ProjectFormData {
  /** 项目名称 */
  title: string;
  /** 项目描述 */
  description: string;
  /** 项目链接 */
  url: string;
  /** GitHub 链接 */
  github_url: string;
  /** 封面图片链接 */
  image_url: string;
  /** 技术栈列表 */
  tech_stack: string[];
  /** 排序序号 */
  sort_order: number;
}

/** 初始表单数据 */
const initialForm: ProjectFormData = {
  title: "",
  description: "",
  url: "",
  github_url: "",
  image_url: "",
  tech_stack: [],
  sort_order: 0,
};

/** ProjectFormDialog 组件的属性 */
interface ProjectFormDialogProps {
  /** 弹窗是否打开 */
  open: boolean;
  /** 模式：创建或编辑 */
  mode: "create" | "edit";
  /** 编辑时的项目数据 */
  project: Project | null;
  /** 创建项目回调 */
  onCreate: (data: CreateProjectInput) => void;
  /** 更新项目回调 */
  onUpdate: (id: string, data: UpdateProjectInput) => void;
  /** 关闭弹窗回调 */
  onClose: () => void;
  /** 是否正在提交 */
  isPending: boolean;
}

/**
 * 项目表单弹窗
 */
export function ProjectFormDialog({
  open,
  mode,
  project,
  onCreate,
  onUpdate,
  onClose,
  isPending,
}: ProjectFormDialogProps) {
  const [form, setForm] = useState<ProjectFormData>(initialForm);
  const [techInput, setTechInput] = useState("");

  // 打开弹窗时初始化表单
  const handleOpenChange = (v: boolean) => {
    if (v) {
      if (mode === "edit" && project) {
        setForm({
          title: project.title,
          description: project.description ?? "",
          url: project.url ?? "",
          github_url: project.github_url ?? "",
          image_url: project.image_url ?? "",
          tech_stack: [...project.tech_stack],
          sort_order: project.sort_order,
        });
      } else {
        setForm(initialForm);
      }
      setTechInput("");
    } else {
      onClose();
    }
  };

  /** 添加技术栈标签 */
  const addTechTag = () => {
    const tag = techInput.trim();
    if (tag && !form.tech_stack.includes(tag)) {
      setForm((prev) => ({ ...prev, tech_stack: [...prev.tech_stack, tag] }));
    }
    setTechInput("");
  };

  /** 移除技术栈标签 */
  const removeTechTag = (tag: string) => {
    setForm((prev) => ({
      ...prev,
      tech_stack: prev.tech_stack.filter((t) => t !== tag),
    }));
  };

  /** 提交表单 */
  const handleSubmit = () => {
    const title = form.title.trim();
    if (!title) return;

    if (mode === "create") {
      onCreate({
        title,
        description: form.description.trim() || undefined,
        url: form.url.trim() || undefined,
        github_url: form.github_url.trim() || undefined,
        image_url: form.image_url.trim() || undefined,
        tech_stack: form.tech_stack.length > 0 ? form.tech_stack : undefined,
        sort_order: form.sort_order,
      });
    } else if (project) {
      onUpdate(project.id, {
        title,
        description: form.description.trim() || undefined,
        url: form.url.trim() || undefined,
        github_url: form.github_url.trim() || undefined,
        image_url: form.image_url.trim() || undefined,
        tech_stack: form.tech_stack.length > 0 ? form.tech_stack : undefined,
        sort_order: form.sort_order,
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md sm:max-w-lg md:max-w-xl lg:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "新建项目" : "编辑项目"}
          </DialogTitle>
          <DialogDescription>
            {mode === "create" ? "填写项目信息来创建新项目" : "修改项目信息"}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="project-title">项目名称</Label>
            <Input
              id="project-title"
              value={form.title}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, title: e.target.value }))
              }
              placeholder="请输入项目名称"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="project-desc">描述（可选）</Label>
            <Textarea
              id="project-desc"
              value={form.description}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, description: e.target.value }))
              }
              placeholder="请输入项目描述"
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="project-url">项目链接（可选）</Label>
            <Input
              id="project-url"
              value={form.url}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, url: e.target.value }))
              }
              placeholder="https://example.com"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="project-github">GitHub 链接（可选）</Label>
            <Input
              id="project-github"
              value={form.github_url}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, github_url: e.target.value }))
              }
              placeholder="https://github.com/..."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="project-image">封面图片链接（可选）</Label>
            <Input
              id="project-image"
              value={form.image_url}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, image_url: e.target.value }))
              }
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
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  sort_order: Number(e.target.value),
                }))
              }
              placeholder="0"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!form.title.trim() || isPending}
          >
            {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
            {mode === "create" ? "创建" : "保存"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
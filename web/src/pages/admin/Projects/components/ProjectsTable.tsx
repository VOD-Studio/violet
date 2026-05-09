/**
 * 项目表格组件
 * 展示项目列表，支持编辑和删除操作
 */

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Pencil, Trash2, ExternalLink, FolderKanban } from "lucide-react";
import type { Project } from "@/features/projects";

/** ProjectsTable 组件的属性 */
interface ProjectsTableProps {
  /** 项目列表数据 */
  projects: Project[];
  /** 编辑项目回调 */
  onEdit: (project: Project) => void;
  /** 删除项目回调 */
  onDelete: (project: Project) => void;
}

/**
 * 项目表格
 */
export function ProjectsTable({
  projects,
  onEdit,
  onDelete,
}: ProjectsTableProps) {
  return (
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
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onEdit(project)}
                    title="编辑"
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => onDelete(project)}
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
  );
}
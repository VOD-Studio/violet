/**
 * 标签管理页面
 * 支持创建、删除标签，展示标签列表
 */

import { useState } from "react";
import { useAdminTags } from "@/hooks/useAdmin";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorFallback } from "@/components/shared/ErrorFallback";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

/** 标签结构 */
interface ApiTag {
  id: number;
  name: string;
  slug: string;
}

/**
 * 标签管理页面
 */
export default function Tags() {
  const { data: tags, isLoading, error, refetch } = useAdminTags();

  /** 新建标签表单状态 */
  const [newTagName, setNewTagName] = useState("");
  const [creating, setCreating] = useState(false);

  /** 删除确认弹窗状态 */
  const [deleteConfirm, setDeleteConfirm] = useState<{
    open: boolean;
    id: number;
    name: string;
  }>({
    open: false,
    id: 0,
    name: "",
  });

  /**
   * 创建新标签
   */
  async function handleCreate() {
    if (!newTagName.trim()) {
      toast.error("请输入标签名称");
      return;
    }

    setCreating(true);
    try {
      await api.post<ApiTag>("/tags", { name: newTagName.trim() });
      toast.success("标签创建成功");
      setNewTagName("");
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "创建失败");
    } finally {
      setCreating(false);
    }
  }

  /**
   * 弹出删除确认
   */
  function handleDelete(id: number, name: string) {
    setDeleteConfirm({ open: true, id, name });
  }

  /**
   * 确认删除标签
   */
  async function confirmDelete() {
    try {
      await api.del(`/tags/${deleteConfirm.id}`);
      toast.success("标签已删除");
      setDeleteConfirm({ open: false, id: 0, name: "" });
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "删除失败");
      setDeleteConfirm({ open: false, id: 0, name: "" });
    }
  }

  return (
    <div className="space-y-6">
      {/* 页面头部 */}
      <div>
        <h1 className="text-2xl font-bold">标签管理</h1>
        <p className="text-muted-foreground">管理文章分类标签</p>
      </div>

      {/* 创建新标签 */}
      <Card>
        <CardHeader>
          <CardTitle>创建标签</CardTitle>
          <CardDescription>添加新的文章分类标签</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Input
              placeholder="输入标签名称"
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              className="max-w-xs"
              disabled={creating}
            />
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? (
                <Loader2 className="mr-1 size-4 animate-spin" />
              ) : (
                <Plus className="mr-1 size-4" />
              )}
              创建
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 标签列表 */}
      <Card>
        <CardHeader>
          <CardTitle>标签列表</CardTitle>
          <CardDescription>所有已创建的标签</CardDescription>
        </CardHeader>
        <CardContent>
          {/* 加载态 */}
          {isLoading && (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          )}

          {/* 错误状态 */}
          {error && <ErrorFallback error={error.message} onRetry={refetch} />}

          {/* 空数据状态 */}
          {!isLoading && !error && (!tags || tags.length === 0) && (
            <EmptyState
              title="暂无标签"
              description="点击上方按钮创建第一个标签"
            />
          )}

          {/* 标签表格 */}
          {!isLoading && !error && tags && tags.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">ID</TableHead>
                  <TableHead>名称</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tags.map((tag: ApiTag) => (
                  <TableRow key={tag.id}>
                    <TableCell className="font-mono text-sm">
                      {tag.id}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{tag.name}</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm text-muted-foreground">
                      {tag.slug}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleDelete(tag.id, tag.name)}
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 删除确认弹窗 */}
      <ConfirmDialog
        open={deleteConfirm.open}
        onClose={() => setDeleteConfirm({ open: false, id: 0, name: "" })}
        onConfirm={confirmDelete}
        title="删除标签"
        description={`确定要删除标签「${deleteConfirm.name}」吗？已关联此标签的文章将解除关联。`}
        confirmLabel="删除"
        destructive
      />
    </div>
  );
}

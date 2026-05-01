/**
 * 文章管理页面
 * 调用 API 获取文章列表，支持状态筛选和增删改操作
 * 使用 react-query 管理数据获取和变更操作
 */

import { useState } from "react";
import { useNavigate } from "react-router";
import {
  useAdminPosts,
  useTogglePostStatus,
  useDeleteAdminPost,
} from "@/hooks/useAdmin";
import type { PostStatus, ApiPost } from "@/hooks/useAdmin";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Plus } from "lucide-react";
import { toast } from "sonner";

/** 筛选标签配置 */
const statusFilters: { label: string; value: "all" | PostStatus }[] = [
  { label: "全部", value: "all" },
  { label: "已发布", value: "published" },
  { label: "草稿", value: "draft" },
];

/**
 * 将 ISO 日期字符串格式化为简短的本地日期
 */
function formatDate(isoString: string | null | undefined): string {
  if (!isoString) return "-";
  return new Date(isoString).toLocaleDateString("zh-CN");
}

/** 表格骨架屏 */
function PostsTableSkeleton() {
  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>标题</TableHead>
            <TableHead>状态</TableHead>
            <TableHead className="text-right">浏览量</TableHead>
            <TableHead>发布时间</TableHead>
            <TableHead>更新时间</TableHead>
            <TableHead className="text-right">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 5 }).map((_, i) => (
            <TableRow key={i}>
              <TableCell>
                <Skeleton className="h-4 w-40" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-5 w-12" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-16 ml-auto" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-24" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-24" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-8 ml-auto" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/**
 * 文章管理页面
 */
export default function Posts() {
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState<"all" | PostStatus>("all");
  const [page] = useState(1);

  /** 删除确认弹窗状态 */
  const [deleteConfirm, setDeleteConfirm] = useState<{
    open: boolean;
    id: string;
  }>({ open: false, id: "" });

  const { data, isLoading, error, refetch } = useAdminPosts({
    page,
    limit: 20,
    status: activeFilter === "all" ? undefined : activeFilter,
  });
  const toggleMutation = useTogglePostStatus();
  const deleteMutation = useDeleteAdminPost();

  const posts = data?.posts ?? [];

  /**
   * 切换文章发布状态
   */
  function handleToggleStatus(post: ApiPost) {
    const newStatus: PostStatus =
      post.status === "published" ? "draft" : "published";
    toggleMutation.mutate(
      { id: post.id, status: newStatus },
      {
        onSuccess: () =>
          toast.success(post.status === "published" ? "已取消发布" : "已发布"),
        onError: () => toast.error("操作失败，请重试"),
      }
    );
  }

  /**
   * 弹出删除确认
   */
  function handleDelete(id: string) {
    setDeleteConfirm({ open: true, id });
  }

  /**
   * 确认删除
   */
  function confirmDelete() {
    deleteMutation.mutate(deleteConfirm.id, {
      onSuccess: () => {
        toast.success("文章已删除");
        setDeleteConfirm({ open: false, id: "" });
      },
      onError: () => {
        toast.error("删除失败，请重试");
        setDeleteConfirm({ open: false, id: "" });
      },
    });
  }

  return (
    <div className="space-y-6">
      {/* 页面头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">文章管理</h1>
          <p className="text-muted-foreground">管理所有博客文章</p>
        </div>
        <Button onClick={() => navigate("/admin/posts/new")}>
          <Plus className="mr-1 size-4" />
          新建文章
        </Button>
      </div>

      {/* 状态筛选标签 */}
      <div className="flex gap-2">
        {statusFilters.map((filter) => (
          <Button
            key={filter.value}
            variant={activeFilter === filter.value ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveFilter(filter.value)}
          >
            {filter.label}
          </Button>
        ))}
      </div>

      {/* 加载态 */}
      {isLoading && <PostsTableSkeleton />}

      {/* 错误状态 */}
      {error && <ErrorFallback error={error.message} onRetry={refetch} />}

      {/* 空数据状态 */}
      {!isLoading && !error && posts.length === 0 && (
        <EmptyState
          title="暂无文章"
          description="点击上方按钮创建你的第一篇文章"
        />
      )}

      {/* 文章列表表格 */}
      {!isLoading && !error && posts.length > 0 && (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>标题</TableHead>
                <TableHead>状态</TableHead>
                <TableHead className="text-right">浏览量</TableHead>
                <TableHead>发布时间</TableHead>
                <TableHead>更新时间</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {posts.map((post: ApiPost) => (
                <TableRow key={post.id}>
                  <TableCell className="font-medium">{post.title}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        post.status === "published" ? "default" : "secondary"
                      }
                    >
                      {post.status === "published" ? "已发布" : "草稿"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {post.viewCount.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(post.publishedAt)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(post.updatedAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger className="flex size-8 cursor-pointer items-center justify-center rounded-md hover:bg-muted">
                        <MoreHorizontal className="size-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() =>
                            navigate(`/admin/posts/${post.id}/edit`)
                          }
                        >
                          编辑
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleToggleStatus(post)}
                        >
                          {post.status === "published" ? "取消发布" : "发布"}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => handleDelete(post.id)}
                        >
                          删除
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* 删除确认弹窗 */}
      <ConfirmDialog
        open={deleteConfirm.open}
        onClose={() => setDeleteConfirm({ open: false, id: "" })}
        onConfirm={confirmDelete}
        title="删除文章"
        description="确定要删除这篇文章吗？此操作不可撤销。"
        confirmLabel="删除"
        destructive
      />
    </div>
  );
}

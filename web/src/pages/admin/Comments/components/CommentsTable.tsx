/**
 * 评论列表表格
 * 展示评论数据，支持行选择和操作菜单
 */

import type { ApiComment } from "@/features/admin/comments/types";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MoreHorizontal,
  CheckSquare,
  Square,
  Trash2,
  CheckCircle,
  XCircle,
  Eye,
} from "lucide-react";
import { getStatusBadge, formatDateTime } from "./helpers";

interface CommentsTableProps {
  comments: ApiComment[];
  selectedIds: Set<string>;
  isAllSelected: boolean;
  isPartialSelected: boolean;
  isActing: boolean;
  onToggleSelectAll: () => void;
  onToggleSelect: (id: string) => void;
  onViewDetail: (id: string) => void;
  onApprove: (id: string) => void;
  onMarkSpam: (id: string) => void;
  onDelete: (id: string) => void;
}

export function CommentsTable({
  comments,
  selectedIds,
  isAllSelected,
  isPartialSelected,
  isActing,
  onToggleSelectAll,
  onToggleSelect,
  onViewDetail,
  onApprove,
  onMarkSpam,
  onDelete,
}: CommentsTableProps) {
  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">
              <button
                onClick={onToggleSelectAll}
                className="flex size-5 cursor-pointer items-center justify-center rounded hover:bg-muted"
                aria-label={isAllSelected ? "取消全选" : "全选"}
              >
                {isAllSelected ? (
                  <CheckSquare className="size-4 text-primary" />
                ) : isPartialSelected ? (
                  <div className="size-3.5 rounded-sm border-2 border-primary bg-primary/50" />
                ) : (
                  <Square className="size-4 text-muted-foreground" />
                )}
              </button>
            </TableHead>
            <TableHead>作者</TableHead>
            <TableHead>内容</TableHead>
            <TableHead>文章</TableHead>
            <TableHead>状态</TableHead>
            <TableHead>时间</TableHead>
            <TableHead className="text-right">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {comments.map((comment: ApiComment) => {
            const isSelected = selectedIds.has(comment.id);
            const statusBadge = getStatusBadge(comment.status);

            return (
              <TableRow
                key={comment.id}
                className={isSelected ? "bg-muted/50" : ""}
              >
                <TableCell>
                  <button
                    onClick={() => onToggleSelect(comment.id)}
                    className="flex size-5 cursor-pointer items-center justify-center rounded hover:bg-muted"
                    aria-label={isSelected ? "取消选择" : "选择"}
                  >
                    {isSelected ? (
                      <CheckSquare className="size-4 text-primary" />
                    ) : (
                      <Square className="size-4 text-muted-foreground" />
                    )}
                  </button>
                </TableCell>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    {comment.avatar_url && (
                      <img
                        src={comment.avatar_url}
                        alt={comment.author_name}
                        className="size-6 rounded-full"
                      />
                    )}
                    <span>{comment.author_name}</span>
                  </div>
                </TableCell>
                <TableCell className="max-w-75">
                  <div className="whitespace-pre-wrap wrap-break-word text-sm">
                    {comment.content?.message ?? "-"}
                  </div>
                  {comment.content?.pictures &&
                    comment.content.pictures.length > 0 && (
                      <div className="mt-1 text-xs text-muted-foreground">
                        {comment.content.pictures.length} 张图片
                      </div>
                    )}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {comment.post_title ?? comment.post_id ?? "-"}
                </TableCell>
                <TableCell>
                  <Badge variant={statusBadge.variant}>
                    {statusBadge.label}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {formatDateTime(comment.created_at)}
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      className="flex size-8 cursor-pointer items-center justify-center rounded-md hover:bg-muted"
                      disabled={isActing}
                    >
                      <MoreHorizontal className="size-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => onViewDetail(comment.id)}
                      >
                        <Eye className="mr-2 h-4 w-4" />
                        查看详情
                      </DropdownMenuItem>
                      {comment.status !== "approved" && (
                        <DropdownMenuItem
                          onClick={() => onApprove(comment.id)}
                        >
                          <CheckCircle className="mr-2 h-4 w-4" />
                          批准
                        </DropdownMenuItem>
                      )}
                      {comment.status !== "spam" && (
                        <DropdownMenuItem
                          onClick={() => onMarkSpam(comment.id)}
                        >
                          <XCircle className="mr-2 h-4 w-4" />
                          标记垃圾
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => onDelete(comment.id)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        删除
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

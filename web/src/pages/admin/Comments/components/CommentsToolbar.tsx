/**
 * 筛选和批量操作工具栏
 */

import type { CommentStatusFilter } from "@/features/admin/comments/types";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CheckCircle, XCircle, Trash2 } from "lucide-react";
import { statusFilterLabels } from "./helpers";

interface CommentsToolbarProps {
  statusFilter: CommentStatusFilter;
  onStatusChange: (value: "all" | "pending" | "approved" | "spam" | null) => void;
  selectedCount: number;
  isActing: boolean;
  onBatchApprove: () => void;
  onBatchMarkSpam: () => void;
  onBatchDelete: () => void;
}

export function CommentsToolbar({
  statusFilter,
  onStatusChange,
  selectedCount,
  isActing,
  onBatchApprove,
  onBatchMarkSpam,
  onBatchDelete,
}: CommentsToolbarProps) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-4">
        {/* 状态筛选下拉框 */}
        <Select value={statusFilter} onValueChange={onStatusChange}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="筛选状态">
              {statusFilterLabels[statusFilter]}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部</SelectItem>
            <SelectItem value="pending">待审核</SelectItem>
            <SelectItem value="approved">已批准</SelectItem>
            <SelectItem value="spam">垃圾</SelectItem>
          </SelectContent>
        </Select>

        {/* 选中数量提示 */}
        {selectedCount > 0 && (
          <span className="text-sm text-muted-foreground">
            已选择 {selectedCount} 条评论
          </span>
        )}
      </div>

      {/* 批量操作按钮 */}
      {selectedCount > 0 && (
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="default"
            onClick={onBatchApprove}
            disabled={isActing}
          >
            <CheckCircle className="mr-1.5 h-4 w-4" />
            批量批准
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={onBatchMarkSpam}
            disabled={isActing}
          >
            <XCircle className="mr-1.5 h-4 w-4" />
            标记垃圾
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={onBatchDelete}
            disabled={isActing}
          >
            <Trash2 className="mr-1.5 h-4 w-4" />
            批量删除
          </Button>
        </div>
      )}
    </div>
  );
}

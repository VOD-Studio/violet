/**
 * 评论详情抽屉
 */

import type { ApiComment } from "@/features/admin/comments/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { CommentContent } from "@/features/comments";
import { User, Globe, Clock, Trash2, CheckCircle, XCircle } from "lucide-react";
import { getStatusBadge, formatDateTime } from "./helpers";

interface CommentDetailSheetProps {
  open: boolean;
  onClose: () => void;
  comment: ApiComment | undefined;
  isLoading: boolean;
  isActing: boolean;
  onApprove: (id: string) => void;
  onMarkSpam: (id: string) => void;
  onDelete: (id: string) => void;
}

export function CommentDetailSheet({
  open,
  onClose,
  comment,
  isLoading,
  isActing,
  onApprove,
  onMarkSpam,
  onDelete,
}: CommentDetailSheetProps) {
  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent side="right" className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>评论详情</SheetTitle>
        </SheetHeader>

        {isLoading && (
          <div className="space-y-4 p-6">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        )}

        {comment && (
          <div className="flex-1 space-y-4 p-6">
            {/* 作者信息 */}
            <div className="flex items-center gap-3">
              {comment.avatar_url ? (
                <img
                  src={comment.avatar_url}
                  alt={comment.author_name}
                  className="size-10 rounded-full"
                />
              ) : (
                <div className="flex size-10 items-center justify-center rounded-full bg-muted">
                  <User className="size-5 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">
                  {comment.author_name}
                </p>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  {comment.author_email && (
                    <span className="truncate">
                      {comment.author_email}
                    </span>
                  )}
                </div>
              </div>
              <Badge variant={getStatusBadge(comment.status).variant}>
                {getStatusBadge(comment.status).label}
              </Badge>
            </div>

            {/* 评论内容 */}
            <div className="rounded-lg border bg-muted/30 p-4">
              {comment.content ? (
                <CommentContent
                  content={comment.content}
                  className="whitespace-pre-wrap wrap-break-word"
                />
              ) : (
                <p className="text-muted-foreground">无内容</p>
              )}
            </div>

            {/* 元信息 */}
            <div className="flex items-center gap-4 text-sm text-muted-foreground border-t pt-4">
              <div className="flex items-center gap-1.5">
                <Clock className="size-4" />
                <span>{formatDateTime(comment.created_at)}</span>
              </div>
              {comment.author_url && (
                <a
                  href={comment.author_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-primary hover:underline"
                >
                  <Globe className="size-4" />
                  <span className="truncate max-w-37.5">网站</span>
                </a>
              )}
            </div>

            {/* 所属文章 */}
            <div className="rounded-lg border p-3 flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                所属文章：
              </span>
              <div className="flex items-center gap-2">
                <span className="font-medium truncate max-w-50">
                  {comment.post_title ?? "未知文章"}
                </span>
                {comment.post_slug && (
                  <a
                    href={`/blog/${comment.post_slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline text-sm"
                  >
                    查看
                  </a>
                )}
              </div>
            </div>

            {/* 操作按钮 */}
            <div className="flex gap-2 border-t pt-4">
              {comment.status !== "approved" && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => {
                    onApprove(comment.id);
                    onClose();
                  }}
                  disabled={isActing}
                >
                  <CheckCircle className="mr-1.5 h-4 w-4" />
                  批准
                </Button>
              )}
              {comment.status !== "spam" && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    onMarkSpam(comment.id);
                    onClose();
                  }}
                  disabled={isActing}
                >
                  <XCircle className="mr-1.5 h-4 w-4" />
                  标记垃圾
                </Button>
              )}
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  onClose();
                  onDelete(comment.id);
                }}
                disabled={isActing}
              >
                <Trash2 className="mr-1.5 h-4 w-4" />
                删除
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

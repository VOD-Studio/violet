/**
 * 评论管理辅助函数和常量
 */

import type { CommentStatusFilter } from "@/features/admin/comments/types";

/**
 * 将 ISO 日期字符串格式化为本地日期时间
 */
export function formatDateTime(isoString: string): string {
  return new Date(isoString).toLocaleString("zh-CN");
}

/**
 * 获取状态对应的 Badge 变体和文本
 */
export function getStatusBadge(status: string) {
  switch (status) {
    case "approved":
      return { variant: "default" as const, label: "已批准" };
    case "pending":
      return { variant: "secondary" as const, label: "待审核" };
    case "spam":
      return { variant: "destructive" as const, label: "垃圾" };
    default:
      return { variant: "outline" as const, label: status };
  }
}

// 状态筛选显示文本映射
export const statusFilterLabels: Record<CommentStatusFilter, string> = {
  all: "全部",
  pending: "待审核",
  approved: "已批准",
  spam: "垃圾",
};

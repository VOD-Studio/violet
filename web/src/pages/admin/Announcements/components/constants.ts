/**
 * 公告管理常量定义
 */

/** 公告类型颜色映射 */
export const typeColors: Record<string, string> = {
  info: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  warning: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  success: "bg-green-500/10 text-green-600 border-green-500/20",
  error: "bg-red-500/10 text-red-600 border-red-500/20",
};

/** 公告类型标签映射 */
export const typeLabels: Record<string, string> = {
  info: "信息",
  warning: "警告",
  success: "成功",
  error: "错误",
};

// 操作日志类型定义

export interface AuditLog {
  id: number;
  user_id?: string;
  user_name: string;
  action: string;
  resource_type: string;
  resource_id?: string;
  resource_name?: string;
  detail?: string;
  ip_address?: string;
  created_at: string;
}

export interface AuditLogListResponse {
  logs: AuditLog[];
  total: number;
  page: number;
  limit: number;
}

// 操作类型映射
export const actionLabels: Record<string, string> = {
  create: "创建",
  update: "更新",
  delete: "删除",
  approve: "审核通过",
  reject: "审核拒绝",
  ban: "封禁",
  unban: "解封",
  publish: "发布",
  unpublish: "取消发布",
  assign_role: "分配角色",
  update_permissions: "更新权限",
  login: "登录",
  logout: "登出",
};

// 资源类型映射
export const resourceTypeLabels: Record<string, string> = {
  post: "文章",
  comment: "评论",
  user: "用户",
  role: "角色",
  setting: "设置",
  tag: "标签",
  media: "媒体",
  emoji: "表情",
  playlist: "歌单",
};
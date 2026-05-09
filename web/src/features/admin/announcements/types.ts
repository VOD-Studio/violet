/**
 * 公告信息
 */
export interface Announcement {
  /** 公告唯一标识 */
  id: number;
  /** 公告标题 */
  title: string;
  /** 公告内容 */
  content: string;
  /** 公告类型：info 信息、warning 警告、success 成功、error 错误 */
  type: "info" | "warning" | "success" | "error";
  /** 是否启用 */
  is_active: boolean;
  /** 开始展示时间 */
  start_time?: string;
  /** 结束展示时间 */
  end_time?: string;
  /** 创建者用户名 */
  created_by?: string;
  /** 创建时间 */
  created_at: string;
  /** 更新时间 */
  updated_at?: string;
}

/**
 * 公告列表响应
 */
export interface AnnouncementListResponse {
  /** 公告列表 */
  announcements: Announcement[];
  /** 总数量 */
  total: number;
  /** 当前页码 */
  page: number;
  /** 每页数量 */
  limit: number;
}

/**
 * 公告创建输入参数
 */
export interface AnnouncementCreateInput {
  /** 公告标题 */
  title: string;
  /** 公告内容 */
  content: string;
  /** 公告类型 */
  type: "info" | "warning" | "success" | "error";
  /** 是否启用，默认 false */
  is_active?: boolean;
  /** 开始展示时间 */
  start_time?: string;
  /** 结束展示时间 */
  end_time?: string;
}

/**
 * 公告更新输入参数
 */
export interface AnnouncementUpdateInput {
  /** 公告标题 */
  title?: string;
  /** 公告内容 */
  content?: string;
  /** 公告类型 */
  type?: "info" | "warning" | "success" | "error";
  /** 是否启用 */
  is_active?: boolean;
  /** 开始展示时间 */
  start_time?: string;
  /** 结束展示时间 */
  end_time?: string;
}
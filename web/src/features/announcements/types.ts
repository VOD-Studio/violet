/**
 * 公告功能类型定义
 */

/** 公告类型 */
export type AnnouncementType = "info" | "warning" | "success" | "error";

/** 公告信息 */
export interface Announcement {
  /** 公告唯一标识 */
  id: number;
  /** 公告标题 */
  title: string;
  /** 公告内容 */
  content: string;
  /** 公告类型 */
  type: AnnouncementType;
  /** 是否启用 */
  is_active: boolean;
  /** 开始时间 */
  start_time?: string;
  /** 结束时间 */
  end_time?: string;
  /** 创建时间 */
  created_at: string;
}

/** 公告列表响应 */
export interface AnnouncementsResponse {
  announcements: Announcement[];
}
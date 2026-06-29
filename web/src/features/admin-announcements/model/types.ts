/**
 * admin-announcements 模块类型定义
 *
 * 对齐后端 application/announcement.AnnouncementDTO
 */

/** 公告类型枚举 */
export type AnnouncementType = "info" | "warning" | "success" | "error";

/**
 * AnnouncementDTO - 公告数据传输对象
 */
export interface AnnouncementDTO {
    /** 公告 ID */
    id: number;
    /** 公告标题 */
    title: string;
    /** 公告正文 */
    content: string;
    /** 公告类型 */
    type: AnnouncementType;
    /** 是否启用 */
    is_active: boolean;
    /** 生效开始时间（RFC3339 字符串，可选） */
    start_time?: string;
    /** 生效结束时间（RFC3339 字符串，可选） */
    end_time?: string;
    /** 创建时间（RFC3339 字符串） */
    created_at: string;
}

/**
 * CreateAnnouncementRequest - 创建公告请求
 */
export interface CreateAnnouncementRequest {
    /** 公告标题 */
    title: string;
    /** 公告正文 */
    content: string;
    /** 公告类型 */
    type: AnnouncementType;
    /** 是否启用 */
    is_active?: boolean;
    /** 生效开始时间（RFC3339 字符串，可选） */
    start_time?: string;
    /** 生效结束时间（RFC3339 字符串，可选） */
    end_time?: string;
}

/**
 * UpdateAnnouncementRequest - 更新公告请求
 */
export interface UpdateAnnouncementRequest {
    /** 公告标题 */
    title: string;
    /** 公告正文 */
    content: string;
    /** 公告类型 */
    type: AnnouncementType;
    /** 是否启用 */
    is_active?: boolean;
    /** 生效开始时间（RFC3339 字符串，可选） */
    start_time?: string;
    /** 生效结束时间（RFC3339 字符串，可选） */
    end_time?: string;
}

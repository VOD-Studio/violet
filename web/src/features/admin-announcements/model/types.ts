/** admin-announcements 模块类型定义 */

/** 公告类型枚举(severity 视觉维度) */
export type AnnouncementType = "info" | "warning" | "success" | "error";

/** 展示形态枚举 */
export type AnnouncementDisplay = "banner" | "card" | "article";

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
    /** 公告类型(severity 同义冗余) */
    type: AnnouncementType;
    /** 严重程度(视觉语义,前端消费此字段) */
    severity: AnnouncementType;
    /** 展示形态 */
    display: AnnouncementDisplay;
    /** 是否启用 */
    is_active: boolean;
    /** 生效开始时间（RFC3339 字符串，可选） */
    start_time?: string;
    /** 生效结束时间（RFC3339 字符串，可选） */
    end_time?: string;
    /** 排序权重 */
    sort_order: number;
    /** 影响范围（功能模块枚举数组） */
    affects?: string[];
    /** Markdown 源（article 形态） */
    content_md?: string;
    /** 渲染后 HTML（article 形态） */
    content_html?: string;
    /** 封面图 URL（article 形态） */
    cover_image?: string;
    /** 摘要（card/article 形态） */
    excerpt?: string;
    /** 创建时间（RFC3339 字符串） */
    created_at: string;
}

/**
 * CreateAnnouncementRequest - 创建公告请求
 */
export interface CreateAnnouncementRequest {
    title: string;
    content: string;
    type: AnnouncementType;
    display?: AnnouncementDisplay;
    is_active?: boolean;
    start_time?: string;
    end_time?: string;
    sort_order?: number;
    affects?: string[];
    content_md?: string;
    content_html?: string;
    cover_image?: string;
    excerpt?: string;
}

/**
 * UpdateAnnouncementRequest - 更新公告请求
 */
export interface UpdateAnnouncementRequest {
    title: string;
    content: string;
    type: AnnouncementType;
    display?: AnnouncementDisplay;
    is_active?: boolean;
    start_time?: string;
    end_time?: string;
    sort_order?: number;
    affects?: string[];
    content_md?: string;
    content_html?: string;
    cover_image?: string;
    excerpt?: string;
}

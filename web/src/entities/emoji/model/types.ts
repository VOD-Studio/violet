/**
 * Emoji 系列 - 表情领域实体
 *
 * 前台表情展示与后台表情管理共享的读模型，跨 feature 复用故归 entities 层，
 * 放置惯例对齐 entities/user、entities/post。
 */

/**
 * Emoji - 单个表情读模型
 *
 * 对应后端 EmojiDTO，text_content/gif_url/source_url/group_id/sort_order
 * 均带 omitempty，为空时后端会省略，故前端标可选。
 */
export interface Emoji {
    /** 表情 ID */
    id: number;
    /** 所属分组 ID，列表接口可能省略 */
    group_id?: number;
    /** 表情名称，同一分组内唯一 */
    name: string;
    /** 静态图片 URL */
    url: string;
    /** 来源页 URL，可选 */
    source_url?: string;
    /** 动图 URL，可选 */
    gif_url?: string;
    /** 文本兜底内容，可选，用于纯文字表情 */
    text_content?: string;
    /** 分组内排序值，默认 0 */
    sort_order?: number;
}

/**
 * EmojiGroup - 表情分组读模型
 *
 * 对应后端 EmojiGroupDTO，列表与详情接口均返回此结构，
 * emojis 字段为分组内表情列表，公开接口仅返回启用分组。
 */
export interface EmojiGroup {
    /** 分组 ID */
    id: number;
    /** 分组名称，用于 URL 与按名查询 */
    name: string;
    /** 分组来源标识，如 system/custom */
    source: string;
    /** 分组封面图 URL，优先显示封面而非名称 */
    cover_url?: string;
    /** 排序值，越小越靠前 */
    sort_order: number;
    /** 是否启用，公开接口恒为 true */
    is_enabled: boolean;
    /** 分组内表情列表，按名查询与全量查询均填充 */
    emojis: Emoji[];
}

/**
 * EmojiUploadResult - 表情图片上传结果
 *
 * 对应后端 EmojiUploadResult，文件落盘到 emojiDir，
 * 返回相对 URL 供后续 CreateEmoji 引用，不落库。
 */
export interface EmojiUploadResult {
    /** 可访问的相对 URL，如 /uploads/emojis/uuid.png */
    url: string;
    /** 服务端重命名后的文件名，UUID + 原扩展名 */
    filename: string;
    /** 文件字节数 */
    size: number;
    /** 嗅探得到的真实 MIME 类型 */
    mime_type: string;
}

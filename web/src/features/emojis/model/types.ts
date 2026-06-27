/**
 * emojis 模块类型定义
 *
 * 对接后端 application/media/service.go 的 EmojiGroupDTO 与 EmojiDTO，
 * handler 序列化的就是这两个 DTO，字段均带 json tag，故前端用 snake_case。
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

/**
 * CreateEmojiGroupRequest - 创建表情分组请求体
 *
 * 对应后端 createEmojiGroupRequest，name 必填，
 * source 省略时后端回填 "system"，is_enabled 省略时默认 true。
 */
export interface CreateEmojiGroupRequest {
    /** 分组名称，必填，同仓内唯一 */
    name: string;
    /** 分组来源，省略时后端回填 system */
    source?: string;
    /** 排序值，默认 0 */
    sort_order?: number;
    /** 是否启用，省略时默认 true，显式传 false 可创建为禁用 */
    is_enabled?: boolean;
}

/**
 * UpdateEmojiGroupRequest - 更新表情分组请求体
 *
 * 对应后端 UpdateEmojiGroup handler 的内联请求结构，
 * sort_order 与 is_enabled 为指针字段，传值才更新，省略保持原值。
 * name 与 source 为零值跳过，空串不覆盖原值。
 */
export interface UpdateEmojiGroupRequest {
    /** 分组名称，空串表示不更新 */
    name?: string;
    /** 分组来源，空串表示不更新 */
    source?: string;
    /** 排序值，传值才更新 */
    sort_order?: number;
    /** 是否启用，传值才更新 */
    is_enabled?: boolean;
}

/**
 * BatchUpdateGroupStatusRequest - 批量启用/禁用分组请求体
 *
 * 对应后端 BatchUpdateEmojiGroupStatus handler 的内联请求结构，
 * ids 至少一项，is_enabled 控制目标状态，返回 affected 更新条数。
 */
export interface BatchUpdateGroupStatusRequest {
    /** 待更新的分组 ID 列表，至少一项 */
    ids: number[];
    /** 目标启用状态，true 启用 false 禁用 */
    is_enabled: boolean;
}

/**
 * CreateEmojiRequest - 在分组内创建表情请求体
 *
 * 对应后端 CreateEmoji handler 的内联请求结构，name 必填，
 * url/gif_url/source_url/text_content 可选，sort_order 默认 0。
 */
export interface CreateEmojiRequest {
    /** 表情名称，必填 */
    name: string;
    /** 静态图片 URL，通常来自 UploadEmoji 的返回 */
    url?: string;
    /** 文本兜底内容，纯文字表情用 */
    text_content?: string;
    /** 动图 URL */
    gif_url?: string;
    /** 来源页 URL */
    source_url?: string;
    /** 分组内排序值，默认 0 */
    sort_order?: number;
}

/**
 * UpdateEmojiRequest - 更新表情请求体
 *
 * 对应后端 UpdateEmoji handler 的内联请求结构。
 * 注意后端用零值判断跳过，空串不会清空 name/url 等字段。
 */
export interface UpdateEmojiRequest {
    /** 表情名称 */
    name?: string;
    /** 静态图片 URL */
    url?: string;
    /** 文本兜底内容 */
    text_content?: string;
    /** 动图 URL */
    gif_url?: string;
    /** 来源页 URL */
    source_url?: string;
    /** 分组内排序值 */
    sort_order?: number;
}

/**
 * CreateResourceResult - 创建资源返回的新 ID
 *
 * 后端 CreateEmojiGroup / CreateEmoji 返回 { id: number }。
 */
export interface CreateResourceResult {
    /** 新建资源 ID */
    id: number;
}

/**
 * BatchUpdateResult - 批量操作返回的受影响条数
 *
 * 后端 BatchUpdateEmojiGroupStatus 返回 { affected: number }。
 */
export interface BatchUpdateResult {
    /** 受影响的记录条数 */
    affected: number;
}

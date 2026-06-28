/**
 * media 模块类型定义
 *
 * 仅包含媒体资源管理相关类型（读模型/列表查询/批量删除/缩略图/admin）。
 * 上传相关类型（InitUploadRequest/CompleteUploadResult 等）已统一归到
 * upload 模块，本模块不重复定义。
 *
 * 字段来源：application/media/service.go 的 FileDTO，带 json tag，snake_case。
 */

/**
 * MediaFile - 媒体文件读模型
 *
 * 对应后端 FileDTO，GET /media/{id} 与列表接口共用。
 */
export interface MediaFile {
    /** 文件 ID，UUID */
    id: string;
    /** 所有者用户 ID */
    owner_id: string;
    /** 用途分类，如 material / avatar / cover */
    purpose: string;
    /** 原始文件名 */
    original_name: string;
    /** 可访问 URL */
    url: string;
    /** 文件大小，单位字节 */
    size: number;
    /** MIME 类型 */
    mime_type: string;
    /** 缩略图 URL，无缩略图为空串 */
    thumbnail: string;
    /** 文件状态，如 active / deleted */
    status: string;
    /** 创建时间，RFC3339 字符串 */
    created_at: string;
}

/**
 * MediaListQuery - 媒体列表查询参数
 *
 * 后端 ListFiles handler 解析 page/limit/purpose 三个 query 参数，
 * purpose 为用途筛选，不传则返回全部用途。
 */
export interface MediaListQuery {
    /** 页码，从 1 开始，默认 1 */
    page?: number;
    /** 每页条数，默认 20，后端限制上限 100 */
    limit?: number;
    /** 用途筛选，如 material / avatar / cover */
    purpose?: string;
}

/**
 * BatchDeleteRequest - 批量删除请求体
 *
 * 对接 POST /media/batch-delete，handler 要求 ids 至少一个。
 */
export interface BatchDeleteRequest {
    /** 待删除媒体 ID 列表 */
    ids: string[];
}

/**
 * BatchDeleteResult - 批量删除结果
 *
 * 后端返回实际删除条数，被引用未删的不计入。
 */
export interface BatchDeleteResult {
    /** 实际删除数量 */
    deleted: number;
}

/**
 * ThumbnailUploadResult - 缩略图上传结果
 *
 * 对接 POST /media/{id}/thumbnail，后端返回缩略图可访问 URL。
 */
export interface ThumbnailUploadResult {
    /** 缩略图 URL */
    thumbnail: string;
}

// ============================================================
// admin 文件管理
// ============================================================

/**
 * InstantCheckQuery - 秒传检查查询参数
 *
 * 对接 GET /admin/files/instant，后端 handler 要求 hash 非空。
 */
export interface InstantCheckQuery {
    /** 文件哈希，必填 */
    hash: string;
}

/**
 * InstantCheckResult - 秒传检查结果
 *
 * exists 为 false 时 file 为 null。
 */
export interface InstantCheckResult {
    /** 命中的文件信息，未命中为 null */
    file: MediaFile | null;
    /** 是否命中已存在文件 */
    exists: boolean;
}

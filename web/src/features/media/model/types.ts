/**
 * media 模块类型定义
 *
 * 对接后端 GET /media、DELETE /media/{id}、POST /media/batch-delete、
 * POST /media/{id}/thumbnail，以及分片上传 /upload/* 与 admin /admin/files/*。
 *
 * 字段来源：application/media/service.go 的 FileDTO / InitSessionResult / MergeResult，
 * 这些 DTO 均带 json tag，故字段为 snake_case。
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
// 分片上传
// ============================================================

/**
 * InitUploadRequest - 初始化上传会话请求体
 *
 * 对接 POST /upload/init。fileName/fileSize 必填，
 * fileHash 传则触发秒传或断点续传检查。
 */
export interface InitUploadRequest {
    /** 文件名，必填，后端据此校验扩展名 */
    fileName: string;
    /** 文件总大小，单位字节，必填 */
    fileSize: number;
    /** 文件哈希，传则启用秒传或续传恢复 */
    fileHash?: string;
    /** MIME 类型，不传则由扩展名推断 */
    mimeType?: string;
    /** 分片大小，单位字节，不传则后端默认 5MB */
    chunkSize?: number;
    /** 用途分类，不传则默认 material */
    purpose?: string;
}

/**
 * InitUploadResult - 初始化上传会话响应
 *
 * 三种形态：
 * - 秒传命中：instant=true，返回 file_id 与 url
 * - 续传恢复：upload_id 对应已有会话，uploaded_chunks 列出已上传分片
 * - 新建会话：upload_id 为新 ID，uploaded_chunks 为空
 */
export interface InitUploadResult {
    /** 是否秒传命中 */
    instant: boolean;
    /** 秒传命中时的文件 ID */
    file_id?: string;
    /** 秒传命中时的可访问 URL */
    url?: string;
    /** 上传会话 ID，秒传命中时省略 */
    upload_id?: string;
    /** 分片大小，单位字节 */
    chunk_size: number;
    /** 总分片数 */
    total_chunks: number;
    /** 已上传分片索引列表，用于断点续传 */
    uploaded_chunks: number[];
}

/**
 * UploadStatus - 上传状态查询响应
 *
 * 对接 GET /upload/{uploadId}/status，复用 InitSessionResult 结构。
 */
export type UploadStatus = InitUploadResult;

/**
 * CompleteUploadResult - 合并分片结果
 *
 * 对接 POST /upload/{uploadId}/complete。
 */
export interface CompleteUploadResult {
    /** 最终文件 ID */
    file_id: string;
    /** 可访问 URL */
    url: string;
    /** 缩略图 URL，无缩略图为空串 */
    thumbnail?: string;
    /** 图片宽度，非图片为 0 */
    width?: number;
    /** 图片高度，非图片为 0 */
    height?: number;
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

/**
 * upload 模块类型定义
 *
 * 对接后端分片上传接口链路：初始化会话 → 上传分片 → 合并完成。
 * 字段来源：application/media/service.go 的 InitUploadSession 与 Merge 结果，
 * 已带 json tag，snake_case。
 *
 * upload 模块是项目级「上传能力」归属地：
 * - 裸请求函数（initUpload/uploadChunk/completeUpload）
 * - 通用分片上传 hook（useChunkedUpload，封装秒传/续传/进度）
 * - 工具（sha256 / imageUrl）
 * 业务侧的「资源管理」（如 media 模块的 list/delete/metadata）依赖本模块的上传能力。
 */

/**
 * InitUploadRequest - 初始化上传会话请求体
 *
 * 对应后端 handler media.initUploadSession 的请求结构。
 * fileHash/mimeType/chunkSize/purpose 均可选，不传时由后端补默认值。
 */
export interface InitUploadRequest {
    /** 文件名，必填，后端据此校验扩展名 */
    fileName: string;
    /** 文件总大小，单位字节，必填 */
    fileSize: number;
    /** 文件 SHA-256 哈希，传则启用秒传或续传恢复 */
    fileHash?: string;
    /** MIME 类型，不传则由扩展名推断 */
    mimeType?: string;
    /** 单分片大小，不传则后端默认 5MB */
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
 * CompleteUploadResult - 合并分片完成上传响应
 *
 * 对应后端 Merge 结果，返回最终文件信息。
 */
export interface CompleteUploadResult {
    /** 文件 ID */
    file_id: string;
    /** 文件访问 URL */
    url: string;
    /** 缩略图 URL，无缩略图为空串 */
    thumbnail?: string;
    /** 图片宽度，非图片为 0 */
    width?: number;
    /** 图片高度，非图片为 0 */
    height?: number;
}

/** 向后兼容别名：旧代码用 MergeResult / InitSessionResult */
export type MergeResult = CompleteUploadResult;
export type InitSessionResult = InitUploadResult;
